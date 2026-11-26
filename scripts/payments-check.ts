import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createBillingService, type BillingActor } from "../src/lib/billing/service";
import { BILLING_TERMS_VERSION } from "../src/lib/billing/catalog";
import { PaymentError } from "../src/lib/billing/config";
import { assertPaymentOrigin, readPaymentBody } from "../src/lib/billing/http";

// Base real del proyecto en un directorio temporal; jamás modifica la cuenta demo.
async function main() {
  const dir = mkdtempSync(join(tmpdir(), "compa-payments-"));
  process.env.COMPA_DB_PATH = join(dir, "test.db");
  process.env.CULQI_PUBLIC_KEY = "pk_test_fixture";
  process.env.CULQI_SECRET_KEY = "sk_test_fixture";
  process.env.COMPA_PAYMENT_SIMULATOR = "1";
  const { getDb } = await import("../src/lib/db");
  const db = getDb();
  const input = (provider: "culqi" | "demo" = "culqi", planId = "pro") => ({
    provider, planId, requestId: randomUUID(), acceptedTerms: true, legalVersion: BILLING_TERMS_VERSION,
    buyer: { firstName: "Ana", lastName: "Prueba", email: "review@culqi.com", phone: "+51 900000001" },
    invoice: { type: "boleta", documentNumber: "", legalName: "" },
  });
  const token = (prefix = "tkn") => `${prefix}_test_${randomUUID().replaceAll("-", "")}`;
  const payload = () => ({ tokenId: token(), deviceId: "device-fingerprint-123" });
  const rejected = (status: number) => (e: unknown) => e instanceof PaymentError && e.status === status;
  function actor(): BillingActor {
    const companyId = Number(db.prepare("INSERT INTO companies(name) VALUES ('Empresa prueba')").run().lastInsertRowid);
    const email = `test-${companyId}@example.com`;
    const userId = Number(db.prepare("INSERT INTO users(company_id,email,password_hash,name) VALUES (?,?,'unused','Ana Prueba')").run(companyId, email).lastInsertRowid);
    return { companyId, userId, email, name: "Ana Prueba", role: "admin" };
  }
  function fixture() {
    const user = actor();
    const calls: { path: string; body?: Record<string, unknown> }[] = [];
    const resources = new Map<string, Record<string, unknown>>();
    const control: { charge: "capture" | "challenge" | "decline" | "timeout"; patch: Record<string, unknown>; lastCharge: string } = { charge: "capture", patch: {}, lastCharge: "" };
    const mock: typeof fetch = async (url, options) => {
      assert.match(String(url), /^https:\/\/api\.culqi\.com\/v2\//);
      assert.equal(new Headers(options?.headers).get("authorization"), "Bearer sk_test_fixture");
      const path = new URL(String(url)).pathname.replace("/v2", "");
      const body = options?.body ? JSON.parse(String(options.body)) as Record<string, unknown> : undefined;
      calls.push({ path, body });
      if (!body) return Response.json({ ...resources.get(path), ...control.patch });
      if (path === "/orders") {
        const id = token("ord");
        const resource = { ...body, object: "order", id, state: "created" };
        resources.set(`/orders/${id}`, resource); return Response.json(resource, { status: 201 });
      }
      assert.equal(path, "/charges");
      if (control.charge === "challenge" && !body.authentication_3DS) return Response.json({ object: "error", action_code: "REVIEW" }, { status: 200 });
      if (control.charge === "decline") return Response.json({ object: "error", user_message: "Fondos insuficientes" }, { status: 402 });
      const id = token("chr"); control.lastCharge = id;
      const resource = { ...body, id, object: "charge", source: { id: body.source_id }, capture: true, paid: false, amount_refunded: 0, current_amount: body.amount };
      resources.set(`/charges/${id}`, resource);
      if (control.charge === "timeout") throw new Error("Network timeout after capture");
      return Response.json(resource, { status: 201 });
    };
    return { user, calls, resources, control, service: createBillingService(db, mock) };
  }
  try {
    await test("Planes: precio del servidor, consentimiento y datos recordados", async () => {
      const { user, service, calls } = fixture();
      await assert.rejects(service.checkout(user, { ...input(), acceptedTerms: false }), rejected(400));
      await assert.rejects(service.checkout(user, { ...input(), legalVersion: "old" }), rejected(400));
      const result = await service.checkout(user, { ...input(), amount: 1, companyId: 999, days: 9999 });
      assert.equal(result.payment.amount, 7990); assert.equal(result.payment.mode, "TEST");
      assert.equal(calls[0].body?.amount, 7990); assert.equal(calls[0].body?.confirm, false);
      assert.equal(result.checkout?.client.email, "review@culqi.com");
      assert.equal(service.overview(user).buyer.phone, "900000001");
      assert.equal(service.overview(user).memberships.length, 0);
      assert.equal(JSON.stringify(service.overview(user)).includes("sk_test_"), false);
    });
    await test("Crear dos veces la misma compra solo genera una orden", async () => {
      const { user, service, calls } = fixture(); const body = input();
      const first = await service.checkout(user, body); const second = await service.checkout(user, body);
      assert.equal(first.payment.id, second.payment.id); assert.equal(calls.length, 1);
      await assert.rejects(service.checkout(user, { ...body, planId: "empresa" }), rejected(409));
    });
    await test("Aislamiento por empresa y permisos de administrador", async () => {
      const { user, service } = fixture(); const other = actor();
      const order = await service.checkout(user, input("demo"));
      assert.equal(service.overview(other).payments.length, 0);
      await assert.rejects(service.status(other, order.payment.id), rejected(404));
      await assert.rejects(service.resume(other, order.payment.id), rejected(404));
      assert.throws(() => service.simulate(other, order.payment.id, { outcome: "paid", method: "QR" }), rejected(404));
      await assert.rejects(service.charge(other, order.payment.id, payload()), rejected(404));
      assert.throws(() => service.cancelAuthentication(other, order.payment.id), rejected(404));
      await assert.rejects(service.checkout({ ...user, role: "viewer" }, input()), rejected(403));
    });
    await test("Simulador: pendiente/rechazado no activa; aprobado activa solo SIMULATED", async () => {
      const { user, service, calls } = fixture(); const a = await service.checkout(user, input("demo"));
      service.simulate(user, a.payment.id, { outcome: "pending", method: "QR" });
      assert.equal(service.overview(user).memberships.length, 0);
      service.simulate(user, a.payment.id, { outcome: "failed", method: "QR" });
      assert.equal(service.overview(user).memberships.length, 0);
      assert.throws(() => service.simulate(user, a.payment.id, { outcome: "paid", method: "QR" }), rejected(409));
      const b = await service.checkout(user, input("demo"));
      service.simulate(user, b.payment.id, { outcome: "paid", method: "QR" });
      const membership = service.overview(user).memberships[0];
      assert.equal(membership.mode, "SIMULATED"); assert.equal(membership.active, true);
      service.simulate(user, b.payment.id, { outcome: "paid", method: "QR" });
      assert.equal(service.overview(user).memberships[0].activeUntil, membership.activeUntil);
      assert.equal(calls.length, 0);
    });
    await test("El simulador jamás aprueba una compra Culqi ni permite Cuotéalo menor a S/100", async () => {
      const { user, service } = fixture(); const a = await service.checkout(user, input());
      assert.throws(() => service.simulate(user, a.payment.id, { outcome: "paid", method: "QR" }), rejected(403));
      const b = await service.checkout(user, input("demo"));
      assert.throws(() => service.simulate(user, b.payment.id, { outcome: "paid", method: "Cuotéalo" }), rejected(400));
      const c = await service.checkout(user, input("culqi", "empresa"));
      assert.equal(c.checkout?.paymentMethods.cuotealo, true); assert.equal(a.checkout?.paymentMethods.cuotealo, false);
    });
    await test("Cargo capturado se verifica por GET y activa aunque todavía no esté abonado", async () => {
      const { user, service, calls } = fixture(); const a = await service.checkout(user, input()); const body = payload();
      const result = await service.charge(user, a.payment.id, body);
      assert.equal(result.paid, true); assert.equal(result.payment.method, "Tarjeta");
      assert.match(calls.at(-1)!.path, /^\/charges\/chr_test_/);
      const charge = calls.find((c) => c.path === "/charges")!.body!;
      assert.equal(charge.email, "review@culqi.com"); assert.equal(charge.amount, 7990);
      const before = service.overview(user).memberships[0].activeUntil;
      await service.charge(user, a.payment.id, body);
      await service.webhook({ type: "charge.creation.succeeded", data: JSON.stringify({ id: result.payment.transactionId }) });
      assert.equal(service.overview(user).memberships[0].activeUntil, before);
      assert.equal(calls.filter((c) => c.path === "/charges").length, 1);
    });
    await test("Yape utiliza su token y registra el medio correcto", async () => {
      const { user, service } = fixture(); const a = await service.checkout(user, input());
      const result = await service.charge(user, a.payment.id, { ...payload(), tokenId: token("ype") });
      assert.equal(result.paid, true); assert.equal(result.payment.method, "Yape");
    });
    await test("3DS: desafío, mismo token y dispositivo, cargo autenticado único", async () => {
      const { user, service, control, calls } = fixture(); control.charge = "challenge";
      const a = await service.checkout(user, input()); const b = payload();
      assert.equal((await service.charge(user, a.payment.id, b)).requires3DS, true);
      assert.equal(service.overview(user).memberships.length, 0);
      await assert.rejects(service.charge(user, a.payment.id, b), rejected(409));
      const auth = { eci: "05", cavv: "fixture", protocolVersion: "2.2.0" };
      await assert.rejects(service.charge(user, a.payment.id, { ...b, deviceId: "different-device", authentication3DS: auth }), rejected(409));
      assert.equal((await service.charge(user, a.payment.id, { ...b, authentication3DS: auth })).paid, true);
      assert.equal(calls.filter((c) => c.path === "/charges").length, 2);
    });
    await test("Cancelar 3DS permite un token nuevo sin reutilizar el anterior", async () => {
      const { user, service, control } = fixture(); control.charge = "challenge";
      const a = await service.checkout(user, input()); const b = payload();
      await service.charge(user, a.payment.id, b); service.cancelAuthentication(user, a.payment.id);
      await assert.rejects(service.charge(user, a.payment.id, b), rejected(409));
      control.charge = "capture";
      assert.equal((await service.charge(user, a.payment.id, payload())).paid, true);
    });
    await test("Reabrir el checkout recupera un desafío 3DS abandonado", async () => {
      const { user, service, control } = fixture(); control.charge = "challenge";
      const a = await service.checkout(user, input()); await service.charge(user, a.payment.id, payload());
      await service.resume(user, a.payment.id); control.charge = "capture";
      assert.equal((await service.charge(user, a.payment.id, payload())).paid, true);
    });
    await test("Tokens no se pueden reutilizar entre compras ni aceptar tokens live", async () => {
      const { user, service } = fixture(); const a = await service.checkout(user, input()); const b = payload();
      await service.charge(user, a.payment.id, b); const other = await service.checkout(user, input());
      await assert.rejects(service.charge(user, other.payment.id, b), rejected(409));
      await assert.rejects(service.charge(user, other.payment.id, { ...b, tokenId: "tkn_live_1234567890" }), rejected(400));
    });
    await test("Capturas con importe, moneda, pertenencia o devolución inválidos no activan", async () => {
      for (const patch of [{ amount: 1 }, { currency_code: "USD" }, { capture: false }, { source: { id: token() } }, { metadata: { compa_payment: "other" } }, { amount_refunded: 1 }, { current_amount: 100 }]) {
        const { user, service, control } = fixture(); const a = await service.checkout(user, input()); control.patch = patch;
        await assert.rejects(service.charge(user, a.payment.id, payload()));
        assert.equal(service.overview(user).memberships.length, 0);
      }
    });
    await test("Respuesta perdida después del cargo bloquea duplicados y se recupera por webhook", async () => {
      const { user, service, control, calls } = fixture(); const a = await service.checkout(user, input()); control.charge = "timeout";
      await assert.rejects(service.charge(user, a.payment.id, payload()), (e: unknown) => e instanceof PaymentError && e.uncertain);
      service.cancelAuthentication(user, a.payment.id);
      await service.resume(user, a.payment.id);
      await assert.rejects(service.charge(user, a.payment.id, payload()), rejected(409));
      assert.equal(service.overview(user).memberships.length, 0);
      await service.webhook({ type: "charge.creation.succeeded", data: { id: control.lastCharge } });
      assert.equal((await service.status(user, a.payment.id)).paid, true);
      assert.equal(calls.filter((c) => c.path === "/charges").length, 1);
    });
    await test("Solicitudes concurrentes de cargo solo envían una transacción", async () => {
      const { user, service, calls } = fixture(); const a = await service.checkout(user, input());
      const results = await Promise.allSettled([service.charge(user, a.payment.id, payload()), service.charge(user, a.payment.id, payload())]);
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(calls.filter((c) => c.path === "/charges").length, 1);
    });
    await test("Rechazo de Culqi conserva el plan sin activar y permite un intento nuevo", async () => {
      const { user, service, control } = fixture(); const a = await service.checkout(user, input()); control.charge = "decline";
      await assert.rejects(service.charge(user, a.payment.id, payload()), rejected(400));
      assert.equal(service.overview(user).memberships.length, 0); control.charge = "capture";
      assert.equal((await service.charge(user, a.payment.id, payload())).paid, true);
    });
    await test("QR: un webhook falso no activa; el estado paid consultado sí, una sola vez", async () => {
      const { user, service, resources } = fixture(); const a = await service.checkout(user, input());
      const event = { type: "order.status.changed", data: { id: a.checkout!.orderId, state: "paid", amount: a.payment.amount } };
      await service.webhook(event); assert.equal(service.overview(user).memberships.length, 0);
      resources.get(`/orders/${a.checkout!.orderId}`)!.state = "paid";
      await service.webhook(event); const before = service.overview(user).memberships[0].activeUntil;
      await service.webhook(event); await service.status(user, a.payment.id);
      assert.equal(service.overview(user).memberships[0].activeUntil, before);
      assert.equal((await service.status(user, a.payment.id)).events!.filter((e) => e.state === "paid").length, 1);
    });
    await test("QR con importe adulterado no activa el plan", async () => {
      const { user, service, resources } = fixture(); const a = await service.checkout(user, input());
      Object.assign(resources.get(`/orders/${a.checkout!.orderId}`)!, { state: "paid", amount: 1 });
      await assert.rejects(service.status(user, a.payment.id), rejected(409));
      assert.equal(service.overview(user).memberships.length, 0);
    });
    await test("Vencimiento impide nuevos cargos, admite confirmaciones tardías verificadas", async () => {
      const { user, service, resources } = fixture(); const a = await service.checkout(user, input());
      db.prepare("UPDATE billing_payments SET expires_at = ? WHERE id = ?").run(Date.now() - 1, a.payment.id);
      await assert.rejects(service.charge(user, a.payment.id, payload()), rejected(409));
      await assert.rejects(service.resume(user, a.payment.id), rejected(409));
      resources.get(`/orders/${a.checkout!.orderId}`)!.state = "paid";
      assert.equal((await service.status(user, a.payment.id)).paid, true);
    });
    await test("Renovar suma 31 días y cada entorno mantiene su propia membresía", async () => {
      const { user, service } = fixture(); const a = await service.checkout(user, input("demo", "emprendedor"));
      service.simulate(user, a.payment.id, { outcome: "paid", method: "Tarjeta" });
      const before = service.overview(user).memberships[0].activeUntil;
      const b = await service.checkout(user, input("demo", "empresa"));
      service.simulate(user, b.payment.id, { outcome: "paid", method: "Cuotéalo" });
      assert.equal(service.overview(user).memberships[0].activeUntil, before + 31 * 86400000);
      const c = await service.checkout(user, input()); await service.charge(user, c.payment.id, payload());
      const memberships = service.overview(user).memberships;
      assert.equal(memberships.length, 2);
      assert.equal(memberships.find((m) => m.mode === "SIMULATED")!.planId, "empresa");
      assert.equal(memberships.find((m) => m.mode === "TEST")!.planId, "pro");
    });
    await test("Consultar una simulación vencida actualiza el historial sin activar", async () => {
      const { user, service } = fixture(); const a = await service.checkout(user, input("demo"));
      db.prepare("UPDATE billing_payments SET expires_at = ? WHERE id = ?").run(Date.now() - 1, a.payment.id);
      assert.equal((await service.status(user, a.payment.id)).payment.status, "expired");
      assert.equal(service.overview(user).memberships.length, 0);
    });
    await test("Modo académico rechaza llaves live y respeta deshabilitar el simulador", async () => {
      const { user, service } = fixture();
      try {
        process.env.CULQI_SECRET_KEY = "sk_live_fixture";
        await assert.rejects(service.checkout(user, input()), rejected(503));
        await assert.rejects(service.checkout(user, input("demo")), rejected(404));
        process.env.CULQI_SECRET_KEY = "sk_test_fixture"; process.env.COMPA_PAYMENT_SIMULATOR = "0";
        await assert.rejects(service.checkout(user, input("demo")), rejected(404));
      } finally { process.env.CULQI_SECRET_KEY = "sk_test_fixture"; process.env.COMPA_PAYMENT_SIMULATOR = "1"; }
    });
    await test("El resumen cuenta solo análisis completados de la empresa", () => {
      const { user, service } = fixture();
      const id = db.prepare("INSERT INTO products(company_id,name,price) VALUES (?,'Producto',10)").run(user.companyId).lastInsertRowid;
      db.prepare("INSERT INTO analyses(company_id,product_id,status) VALUES (?,?,'completed'),(?,?,'failed')").run(user.companyId, id, user.companyId, id);
      assert.deepEqual(service.overview(user).usage, { priceAnalyses: 1, strategicAnalyses: 0, products: 1 });
    });
    await test("Límite de solicitudes persiste entre instancias", () => {
      const { service } = fixture(); const key = randomUUID();
      assert.equal(service.rateLimit(key, 2, 60000), true);
      assert.equal(createBillingService(db).rateLimit(key, 2, 60000), true);
      assert.equal(service.rateLimit(key, 2, 60000), false);
    });
    await test("HTTP: bloquea origen ajeno, cuerpos enormes y JSON inválido", async () => {
      const req = (body: string, headers = {}) => new Request("http://localhost:3000/api/payments", { method: "POST", body, headers: { "content-type": "application/json", ...headers } });
      assertPaymentOrigin(req("{}", { origin: "http://localhost:3000" }));
      assert.throws(() => assertPaymentOrigin(req("{}", { origin: "https://attacker.example" })), rejected(403));
      assert.throws(() => assertPaymentOrigin(req("{}", { "sec-fetch-site": "cross-site" })), rejected(403));
      assert.deepEqual(await readPaymentBody(req('{"planId":"pro"}')), { planId: "pro" });
      for (const body of ["null", "[]", "{invalid"]) await assert.rejects(readPaymentBody(req(body)), rejected(400));
      await assert.rejects(readPaymentBody(req("x".repeat(17000))), rejected(413));
      await assert.rejects(readPaymentBody(req("{}", { "content-type": "text/plain" })), rejected(415));
    });
  } finally { db.close(); rmSync(dir, { recursive: true, force: true }); }
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
