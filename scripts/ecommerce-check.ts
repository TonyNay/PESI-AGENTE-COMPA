import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { BILLING_TERMS_VERSION } from "../src/lib/billing/catalog";
import { PaymentError } from "../src/lib/billing/config";
import { renewalNotice } from "../src/lib/billing/limits";
import { createBillingService, type BillingActor } from "../src/lib/billing/service";
import { detectFormat, mapCatalog, stripHtml } from "../src/lib/catalog-import";
import { parseCsv } from "../src/lib/csv";

// Pruebas de los componentes de negocio electrónico agregados: reembolsos con nota de crédito,
// referidos, auditoría, avisos de renovación, Libro de Reclamaciones, importación de catálogos y métricas.
async function main() {
  const dir = mkdtempSync(join(tmpdir(), "compa-ecommerce-"));
  process.env.COMPA_DB_PATH = join(dir, "test.db");
  process.env.CULQI_PUBLIC_KEY = "pk_test_fixture";
  process.env.CULQI_SECRET_KEY = "sk_test_fixture";
  process.env.COMPA_PAYMENT_SIMULATOR = "1";
  const { getDb } = await import("../src/lib/db");
  const { listAudit } = await import("../src/lib/audit");
  const referrals = await import("../src/lib/referrals");
  const complaints = await import("../src/lib/complaints");
  const { platformMetrics } = await import("../src/lib/metrics");
  const db = getDb();
  const DAY = 86_400_000;
  const tok = (prefix: string) => `${prefix}_test_${randomUUID().replaceAll("-", "")}`;

  // Pasarela simulada: órdenes, cargos y devoluciones de Culqi.
  const calls: { path: string; body?: Record<string, unknown> }[] = [];
  const resources = new Map<string, Record<string, unknown>>();
  const control = { refund: "ok" as "ok" | "decline" };
  const culqi: typeof fetch = async (url, options) => {
    const path = new URL(String(url)).pathname.replace("/v2", "");
    const body = options?.body ? JSON.parse(String(options.body)) as Record<string, unknown> : undefined;
    calls.push({ path, body });
    if (!body) return Response.json(resources.get(path) ?? { object: "error" }, { status: resources.has(path) ? 200 : 404 });
    if (path === "/orders") { const id = tok("ord"); const r = { ...body, object: "order", id, state: "created" }; resources.set(`/orders/${id}`, r); return Response.json(r, { status: 201 }); }
    if (path === "/charges") {
      const id = tok("chr");
      const r = { ...body, id, object: "charge", source: { id: body.source_id }, capture: true, amount_refunded: 0, current_amount: body.amount };
      resources.set(`/charges/${id}`, r); return Response.json(r, { status: 201 });
    }
    if (path === "/refunds") {
      if (control.refund === "decline") return Response.json({ object: "error", user_message: "Devolución no permitida" }, { status: 400 });
      return Response.json({ object: "refund", id: tok("ref"), amount: body.amount, charge_id: body.charge_id, reason: body.reason }, { status: 201 });
    }
    throw new Error(`Ruta inesperada ${path}`);
  };
  const service = createBillingService(db, culqi);

  function actor(taxId: string | null = null): BillingActor {
    const companyId = Number(db.prepare("INSERT INTO companies(name, tax_id) VALUES (?, ?)").run(`Empresa ${randomUUID().slice(0, 6)}`, taxId).lastInsertRowid);
    const email = `u${companyId}@example.com`;
    const userId = Number(db.prepare("INSERT INTO users(company_id,email,password_hash,name) VALUES (?,?,'unused','Ana Prueba')").run(companyId, email).lastInsertRowid);
    return { companyId, userId, email, name: "Ana Prueba", role: "admin" };
  }
  const order = (provider: "demo" | "culqi", planId = "pro", invoice: object = { type: "boleta", documentNumber: "", legalName: "" }) => ({
    provider, planId, requestId: randomUUID(), acceptedTerms: true, legalVersion: BILLING_TERMS_VERSION, invoice,
    buyer: { firstName: "Ana", lastName: "Prueba", email: "ana@example.com", phone: "900000001" },
  });
  async function buyDemo(user: BillingActor, planId = "pro") {
    const { payment } = await service.checkout(user, order("demo", planId));
    return service.simulate(user, payment.id, { outcome: "paid", method: "Yape" });
  }
  async function buyCulqi(user: BillingActor, invoice?: object) {
    const { payment } = await service.checkout(user, order("culqi", "pro", invoice));
    return service.charge(user, payment.id, { tokenId: tok("tkn"), deviceId: "device-fingerprint-123" });
  }
  const membership = (companyId: number, mode = "SIMULATED") => db.prepare("SELECT plan_id, active_until FROM billing_memberships WHERE company_id = ? AND mode = ?").get(companyId, mode) as { plan_id: string; active_until: number } | undefined;
  const rejects = (status: number, text?: RegExp) => (e: unknown) => e instanceof PaymentError && e.status === status && (!text || text.test(e.message));
  const analysis = (companyId: number, costUsd?: number) => {
    const productId = Number(db.prepare("INSERT INTO products(company_id,name,price) VALUES (?,'P',10)").run(companyId).lastInsertRowid);
    db.prepare("INSERT INTO analyses(product_id,company_id,status,finished_at,result_json) VALUES (?,?, 'completed', datetime('now'), ?)").run(productId, companyId, JSON.stringify({ meta: { costUsd } }));
  };

  try {
    await test("Reembolso simulado: anula el plan, emite nota de crédito y es idempotente", async () => {
      const user = actor();
      const paid = await buyDemo(user);
      assert.equal(paid.payment.refundable, true);
      const before = membership(user.companyId)!.active_until;
      await assert.rejects(service.refund(user, paid.payment.id, { reason: "no" }), rejects(400));
      const result = await service.refund(user, paid.payment.id, { reason: "No se ajusta a mi negocio" });
      assert.equal(result.payment.status, "refunded");
      assert.equal(result.payment.refundable, false);
      assert.match(result.payment.creditNote!.number, /^BC01-\d{8}$/);
      assert.ok(membership(user.companyId)!.active_until <= Date.now() + 1000 && membership(user.companyId)!.active_until < before);
      const receipt = service.receipt(user, paid.payment.id)!;
      assert.equal(receipt.creditNote!.reference, receipt.number);
      assert.equal(receipt.creditNote!.total, receipt.total);
      const again = await service.refund(user, paid.payment.id, { reason: "Segundo intento duplicado" });
      assert.equal(again.payment.status, "refunded");
      assert.equal(db.prepare("SELECT COUNT(*) AS n FROM billing_credit_notes WHERE payment_id = ?").get(paid.payment.id)!.n, 1);
      const status = await service.status(user, paid.payment.id);
      assert.equal(status.payment.status, "refunded");
      assert.ok(status.events!.some((e) => e.state === "refunded"));
      // Una simulación posterior no puede reactivar una compra reembolsada.
      await assert.rejects(async () => service.simulate(user, paid.payment.id, { outcome: "paid", method: "Yape" }), rejects(409));
    });

    await test("El reembolso respeta el plazo de 7 días, el uso del plan y la empresa dueña", async () => {
      const user = actor();
      const late = await buyDemo(user);
      db.prepare("UPDATE billing_payments SET paid_at = ? WHERE id = ?").run(Date.now() - 8 * DAY, late.payment.id);
      await assert.rejects(service.refund(user, late.payment.id, { reason: "Lo pido tarde" }), rejects(409, /plazo/));
      const used = await buyDemo(user);
      for (let i = 0; i < 6; i++) analysis(user.companyId);
      await assert.rejects(service.refund(user, used.payment.id, { reason: "Usé demasiado" }), rejects(409, /llevas 6/));
      const other = actor();
      await assert.rejects(service.refund(other, used.payment.id, { reason: "No es mía" }), rejects(404));
      await assert.rejects(service.refund({ ...user, role: "member" }, used.payment.id, { reason: "Sin permiso" }), rejects(403));
    });

    await test("Reembolso en Culqi: usa el cargo verificado, factura → nota FC01; rechazo permite reintentar", async () => {
      const user = actor("20100070970");
      const paid = await buyCulqi(user, { type: "factura", documentNumber: "20100070970", legalName: "Empresa Prueba SAC" });
      assert.equal(paid.paid, true);
      control.refund = "decline";
      await assert.rejects(service.refund(user, paid.payment.id, { reason: "Error en la compra" }), rejects(400));
      assert.equal(service.overview(user).payments.find((p) => p.id === paid.payment.id)!.status, "paid");
      control.refund = "ok";
      const result = await service.refund(user, paid.payment.id, { reason: "Error en la compra" });
      assert.equal(result.payment.status, "refunded");
      const call = calls.filter((c) => c.path === "/refunds").at(-1)!;
      assert.equal(call.body!.amount, 7990);
      assert.equal(call.body!.reason, "solicitud_comprador");
      assert.match(String(call.body!.charge_id), /^chr_test_/);
      assert.match(result.payment.creditNote!.number, /^FC01-\d{8}$/);
      // La notificación tardía del cargo ya devuelto no reactiva el plan.
      const verify = await service.webhook({ type: "charge.creation.succeeded", data: { id: call.body!.charge_id } });
      assert.equal((verify as { paid: boolean }).paid, false);
    });

    await test("Pagos por QR u órdenes no admiten devolución automática", async () => {
      const user = actor();
      const { payment } = await service.checkout(user, order("culqi"));
      const orderId = db.prepare("SELECT remote_order_id AS id FROM billing_payments WHERE id = ?").get(payment.id)!.id as string;
      resources.set(`/orders/${orderId}`, { ...resources.get(`/orders/${orderId}`), state: "paid" });
      assert.equal((await service.status(user, payment.id)).paid, true);
      await assert.rejects(service.refund(user, payment.id, { reason: "Quiero mi dinero" }), rejects(409, /QR/));
    });

    await test("Referidos: recompensa el primer pago, una sola vez, y se revierte con el reembolso", async () => {
      const a = actor("20100070970");
      const code = referrals.referralCode(db, a.companyId);
      assert.match(code, /^COMPA-[A-Z2-9]{6}$/);
      assert.equal(referrals.referralCode(db, a.companyId), code);
      assert.equal(referrals.normalizeReferralCode(` ${code.slice(6).toLowerCase()} `), code);
      assert.equal(referrals.linkReferral(db, a.companyId, code), false, "no se puede referir a sí misma");
      assert.equal(referrals.linkReferral(db, actor("20100070970").companyId, code), false, "mismo RUC no cuenta");
      const b = actor();
      assert.equal(referrals.linkReferral(db, b.companyId, code), true);
      assert.equal(referrals.linkReferral(db, b.companyId, code), false, "una sola vinculación");
      assert.equal(membership(a.companyId), undefined);
      const first = await buyDemo(b);
      const reward = membership(a.companyId)!;
      assert.equal(reward.plan_id, "emprendedor");
      assert.ok(Math.abs(reward.active_until - (Date.now() + 31 * DAY)) < 60_000);
      await buyDemo(b);
      assert.equal(membership(a.companyId)!.active_until, reward.active_until, "el segundo pago no vuelve a premiar");
      assert.deepEqual({ ...referrals.referralSummary(db, a.companyId), code: "" }, { code: "", invited: 1, rewarded: 1, daysEarned: 31, maxRewards: 12, rewardDays: 31 });
      assert.ok(listAudit(a.companyId).some((r) => r.action === "referral.reward"));
      await service.refund(b, first.payment.id, { reason: "Prueba de reversión" });
      assert.ok(membership(a.companyId)!.active_until <= Date.now() + 1000);
      assert.equal(referrals.referralSummary(db, a.companyId).rewarded, 0);
    });

    await test("Auditoría: el pago queda registrado y cada usuario ve solo lo suyo", async () => {
      const user = actor();
      await buyDemo(user);
      const rows = listAudit(user.companyId);
      assert.ok(rows.some((r) => r.action === "billing.paid" && r.detail?.includes("Pro")));
      const other = Number(db.prepare("INSERT INTO users(company_id,email,password_hash,name) VALUES (?,?,'x','Otro')").run(user.companyId, `otro${user.companyId}@example.com`).lastInsertRowid);
      assert.equal(listAudit(user.companyId, { userId: other }).length, 0);
      assert.equal(listAudit(actor().companyId).length, 0, "aislamiento por empresa");
    });

    await test("Aviso de renovación: por vencer, vencido reciente y sin aviso", () => {
      const user = actor();
      const now = Date.now();
      const set = (until: number) => db.prepare("INSERT INTO billing_memberships VALUES (?, 'SIMULATED', 'pro', ?, ?) ON CONFLICT(company_id,mode) DO UPDATE SET active_until = excluded.active_until").run(user.companyId, until, now);
      assert.equal(renewalNotice(db, user.companyId, now), null);
      set(now + 20 * DAY); assert.equal(renewalNotice(db, user.companyId, now), null);
      set(now + 3 * DAY - 1000); assert.deepEqual([renewalNotice(db, user.companyId, now)!.state, renewalNotice(db, user.companyId, now)!.daysLeft], ["expiring", 3]);
      set(now - 2 * DAY); assert.equal(renewalNotice(db, user.companyId, now)!.state, "expired");
      set(now - 10 * DAY); assert.equal(renewalNotice(db, user.companyId, now), null);
    });

    await test("Libro de Reclamaciones: plazo de 15 días hábiles con feriados y Semana Santa", () => {
      assert.ok(complaints.peruHolidays(2026).has("2026-04-03"), "Viernes Santo 2026");
      assert.ok(complaints.peruHolidays(2026).has("2026-04-02"), "Jueves Santo 2026");
      // Lunes 23/11/2026 10:00 (Lima) + 15 días hábiles, saltando el 8 y 9 de diciembre → miércoles 16/12/2026.
      const due = complaints.addBusinessDays(Date.parse("2026-11-23T10:00:00-05:00"), 15);
      assert.equal(new Date(due).toISOString(), "2026-12-17T04:59:59.999Z");
    });

    await test("Libro de Reclamaciones: valida, numera, consulta y responde", () => {
      const base = {
        kind: "reclamo", consumerName: "Luis Pérez", documentType: "DNI", documentNumber: "12345678", address: "Jr. Simón Bolívar 123, Huaraz",
        phone: "943 000 111", email: "luis@example.com", minor: false, itemType: "servicio", itemDescription: "Plan Pro de Compa",
        amount: "79.90", detail: "El análisis no terminó y se descontó de mi cupo.", request: "Devolver el análisis al cupo.", responseChannel: "email", acceptedPrivacy: true,
      };
      const now = Date.parse("2026-11-24T15:00:00Z");
      assert.throws(() => complaints.createComplaint({ ...base, documentNumber: "1234567" }, {}, db, now), /DNI/);
      assert.throws(() => complaints.createComplaint({ ...base, minor: true }, {}, db, now), /apoderado/);
      assert.throws(() => complaints.createComplaint({ ...base, acceptedPrivacy: false }, {}, db, now), complaints.ComplaintError);
      const one = complaints.createComplaint(base, { ip: "1.2.3.4" }, db, now);
      const two = complaints.createComplaint({ ...base, kind: "queja", amount: "" }, {}, db, now);
      assert.equal(one.code, "000001-2026");
      assert.equal(two.code, "000002-2026");
      assert.equal(one.amount, 7990);
      assert.equal(two.amount, null);
      assert.equal(one.phone, "943000111");
      assert.equal(complaints.findComplaint("000001-2026", "12345678", db)!.id, one.id);
      assert.equal(complaints.findComplaint("000001-2026", "87654321", db), null);
      assert.equal(complaints.complaintStats(db, now).open, 2);
      assert.equal(complaints.complaintStats(db, one.dueAt + 1).overdue, 2);
      assert.throws(() => complaints.answerComplaint(one.id, "corto", { name: "Staff", email: "s@compa.pe" }, db), /10 a 3000/);
      const answered = complaints.answerComplaint(one.id, "Restituimos el análisis a su cupo y revisamos la causa.", { name: "Staff", email: "s@compa.pe" }, db, now + DAY);
      assert.equal(answered.status, "respondido");
      assert.throws(() => complaints.answerComplaint(one.id, "Otra respuesta más larga", { name: "Staff", email: "s@compa.pe" }, db), /ya fue respondida/);
      const stats = complaints.complaintStats(db, now + DAY);
      assert.deepEqual([stats.open, stats.answered, stats.answeredOnTime], [1, 1, 1]);
    });

    await test("Importación: Shopify con variantes y filas de imagen", () => {
      const csv = [
        "Handle,Title,Body (HTML),Vendor,Product Category,Type,Tags,Option1 Name,Option1 Value,Variant SKU,Variant Price,Image Src,Status",
        "freidora-oster,Freidora de aire Oster 4L,<p>Freidora <strong>digital</strong> de 4&nbsp;L</p>,Oster,Home & Garden > Kitchen > Air Fryers,,\"freidora, air fryer\",Title,Default Title,OST-AF4L,329.00,https://x/1.jpg,active",
        "freidora-oster,,,,,,,,,,,https://x/2.jpg,",
        "polo,Polo básico,,Marca,Apparel,,,Talla,S,POLO-S,39.90,,active",
        "polo,,,,,,,,M,POLO-M,42.90,,",
        "viejo,Producto viejo,,,,,,,,,10,,archived",
      ].join("\n");
      const rows = parseCsv(csv);
      assert.equal(detectFormat(rows[0]), "shopify");
      const m = mapCatalog(rows)!;
      assert.deepEqual(m.rows.map((r) => [r.product.name, r.product.price, r.product.sku]), [
        ["Freidora de aire Oster 4L", "329.00", "OST-AF4L"], ["Polo básico - S", "39.90", "POLO-S"], ["Polo básico - M", "42.90", "POLO-M"],
      ]);
      assert.equal(m.rows[0].product.category, "Air Fryers");
      assert.equal(m.rows[0].product.description, "Freidora digital de 4 L");
      assert.equal(m.rows[0].product.brand, "Oster");
      assert.equal(m.skipped.length, 1);
    });

    await test("Importación: WooCommerce con variable, variaciones, oferta y borrador", () => {
      const csv = [
        "ID,Type,SKU,Name,Published,Short description,Description,Sale price,Regular price,Categories,Tags,Brands",
        "10,variable,CAM,Camiseta,1,,,,,Ropa > Camisetas,,MarcaX",
        "11,variation,CAM-R,Camiseta - Rojo,1,,,,59,,,MarcaX",
        "12,simple,LAP-1,Laptop Lenovo,1,<p>Ryzen 5</p>,,2199,2299,\"Tecnología > Laptops, Ofertas\",lenovo,Lenovo",
        "13,simple,BOR,Borrador,-1,,,,10,,,",
        "14,\"simple, virtual\",SRV-1,Instalación de TV,1,Servicio a domicilio,,,120,Servicios,,",
      ].join("\n");
      const rows = parseCsv(csv);
      assert.equal(detectFormat(rows[0]), "woocommerce");
      const m = mapCatalog(rows)!;
      assert.deepEqual(m.rows.map((r) => [r.product.name, r.product.price, r.product.type]), [
        ["Camiseta - Rojo", "59", "producto"], ["Laptop Lenovo", "2199", "producto"], ["Instalación de TV", "120", "servicio"],
      ]);
      assert.equal(m.rows[1].product.category, "Laptops");
      assert.equal(m.rows[1].product.brand, "Lenovo");
      assert.equal(m.rows[1].product.description, "Ryzen 5");
      assert.equal(m.skipped.length, 2);
    });

    await test("Importación: plantilla de Compa y formato desconocido", () => {
      const rows = parseCsv("nombre;precio;sku\nAudífonos Sony;1299;SON-1\n");
      assert.equal(detectFormat(rows[0]), "compa");
      assert.deepEqual(mapCatalog(rows)!.rows[0].product, { name: "Audífonos Sony", price: "1299", sku: "SON-1" });
      assert.equal(mapCatalog(parseCsv("a,b\n1,2")), null);
      assert.equal(stripHtml("<p>Hola&amp;chau</p><br>fin"), "Hola&chau fin");
    });

    await test("Métricas: MRR, conversión, cancelación, reembolsos y costo de IA medidos", async () => {
      const metricsDir = mkdtempSync(join(tmpdir(), "compa-metrics-"));
      const { DatabaseSync } = await import("node:sqlite");
      const mdb = new DatabaseSync(join(metricsDir, "m.db"));
      mdb.exec(`CREATE TABLE companies (id INTEGER PRIMARY KEY, name TEXT, tax_id TEXT);
        CREATE TABLE users (id INTEGER PRIMARY KEY, company_id INTEGER, email TEXT, password_hash TEXT, name TEXT, role TEXT DEFAULT 'admin');
        CREATE TABLE products (id INTEGER PRIMARY KEY, company_id INTEGER, name TEXT, price REAL);
        CREATE TABLE analyses (id INTEGER PRIMARY KEY, product_id INTEGER, company_id INTEGER, status TEXT, created_at TEXT DEFAULT (datetime('now')), finished_at TEXT, result_json TEXT);
        CREATE TABLE strategic_analyses (id INTEGER PRIMARY KEY, company_id INTEGER, status TEXT, created_at TEXT DEFAULT (datetime('now')), finished_at TEXT, result_json TEXT);`);
      const svc = createBillingService(mdb, culqi);
      const mk = (name: string): BillingActor => {
        const companyId = Number(mdb.prepare("INSERT INTO companies(name) VALUES (?)").run(name).lastInsertRowid);
        const userId = Number(mdb.prepare("INSERT INTO users(company_id,email,password_hash,name) VALUES (?,?,'x','U')").run(companyId, `${name}@x.pe`).lastInsertRowid);
        return { companyId, userId, email: `${name}@x.pe`, name: "U", role: "admin" };
      };
      const buy = async (u: BillingActor, planId: string) => { const { payment } = await svc.checkout(u, order("demo", planId)); return svc.simulate(u, payment.id, { outcome: "paid", method: "Tarjeta" }); };
      const [pro, empresa, refunded] = [mk("pro"), mk("empresa"), mk("reembolso")];
      const lapsed = mk("vencida"); mk("prueba");
      await buy(pro, "pro"); await buy(empresa, "empresa");
      const r = await buy(refunded, "emprendedor"); await svc.refund(refunded, r.payment.id, { reason: "Prueba de métricas" });
      mdb.prepare("INSERT INTO billing_memberships VALUES (?, 'SIMULATED', 'pro', ?, ?)").run(lapsed.companyId, Date.now() - 5 * DAY, Date.now());
      mdb.prepare("INSERT INTO analyses(product_id, company_id, status, finished_at, result_json) VALUES (1, ?, 'completed', datetime('now'), ?)").run(empresa.companyId, JSON.stringify({ meta: { costUsd: 0.2 } }));
      mdb.prepare("INSERT INTO strategic_analyses(company_id, status, finished_at, result_json) VALUES (?, 'completed', datetime('now'), ?)").run(empresa.companyId, JSON.stringify({ meta: { costUsd: 0.1 } }));
      const m = platformMetrics(mdb, { mode: "SIMULATED" });
      assert.equal(m.companies.total, 5);
      assert.equal(m.companies.active, 2);
      assert.equal(m.mrr.gross, 7990 + 14990);
      assert.equal(m.conversion.paying, 3);
      assert.equal(m.companies.trial, 2);
      // La empresa vencida y la reembolsada cuentan como cancelaciones en el periodo.
      assert.deepEqual([m.churn.churned, m.churn.base], [2, 4]);
      assert.equal(m.revenue.gross, 7990 + 14990 + 2990);
      assert.equal(m.revenue.refunds, 2990);
      assert.ok(Math.abs(m.ai.usd - 0.3) < 1e-9);
      assert.equal(m.ai.pen, Math.round(m.ai.usd * 3.75 * 100));
      assert.equal(m.topCompanies[0].name, "empresa");
      assert.equal(platformMetrics(mdb, { mode: "TEST" }).mrr.gross, 0);
      mdb.close(); rmSync(metricsDir, { recursive: true, force: true });
    });
  } finally {
    getDb().close();
    rmSync(dir, { recursive: true, force: true });
  }
}

void main();
