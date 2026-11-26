import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import bcrypt from "bcryptjs";
import { BILLING_TERMS_VERSION, igvBreakdown, isValidRuc } from "../src/lib/billing/catalog";
import { PaymentError } from "../src/lib/billing/config";
import { limitError, limitsOf } from "../src/lib/billing/limits";
import { createBillingService, type BillingActor } from "../src/lib/billing/service";
import { computeStats, normalizeOffers, splitAnomalies } from "../src/lib/agent/normalize";
import type { RawOffer } from "../src/lib/agent/types";
import { redactPersonalData } from "../src/lib/privacy";
import { base32Decode, base32Encode, matchTotp, openSecret, totpCode, totpStep } from "../src/lib/totp";

async function main() {
  const dir = mkdtempSync(join(tmpdir(), "compa-compliance-"));
  process.env.COMPA_DB_PATH = join(dir, "test.db");
  process.env.COMPA_PAYMENT_SIMULATOR = "1";
  process.env.COMPA_TOTP_KEY = randomBytes(32).toString("base64");
  process.env.CULQI_PUBLIC_KEY = "pk_test_fixture";
  process.env.CULQI_SECRET_KEY = "sk_test_fixture";
  const { getDb } = await import("../src/lib/db");
  const account = await import("../src/lib/account");
  const twoFactor = await import("../src/lib/two-factor");
  const db = getDb();
  const service = createBillingService(db, (async () => { throw new Error("sin red"); }) as typeof fetch);
  const password = "contrasena-prueba";
  const hash = bcrypt.hashSync(password, 4);

  function actor(email?: string): BillingActor {
    const companyId = Number(db.prepare("INSERT INTO companies(name, tax_id) VALUES ('Empresa prueba', '20100070970')").run().lastInsertRowid);
    const mail = email ?? `t${companyId}@example.com`;
    const userId = Number(db.prepare("INSERT INTO users(company_id,email,password_hash,name) VALUES (?,?,?,'Ana Prueba')").run(companyId, mail, hash).lastInsertRowid);
    return { companyId, userId, email: mail, name: "Ana Prueba", role: "admin" };
  }
  let demoUser: BillingActor | undefined;
  const demoActor = () => (demoUser ??= actor(account.DEMO_EMAIL));
  const product = (companyId: number) => Number(db.prepare("INSERT INTO products(company_id,name,price) VALUES (?,'P',10)").run(companyId).lastInsertRowid);
  const analysis = (companyId: number, status = "completed") => db.prepare("INSERT INTO analyses(product_id,company_id,status) VALUES (?,?,?)").run(product(companyId), companyId, status);
  const buy = async (user: BillingActor, invoice: object, planId = "pro") => {
    const { payment } = await service.checkout(user, {
      provider: "demo", planId, requestId: randomUUID(), acceptedTerms: true, legalVersion: BILLING_TERMS_VERSION, invoice,
      buyer: { firstName: "Ana", lastName: "Prueba", email: "ana@example.com", phone: "900000001" },
    });
    return service.simulate(user, payment.id, { outcome: "paid", method: "Yape" });
  };
  const offer = (price: number, url = `https://t${price}.pe/p`): RawOffer => ({ competitor: `T${price}`, product_title: "P", price, currency: "PEN", url, match_score: 0.9 } as RawOffer);

  try {
    await test("IGV: la base más el impuesto siempre suman el precio", () => {
      assert.deepEqual(igvBreakdown(2990), { base: 2534, igv: 456, total: 2990 });
      assert.deepEqual(igvBreakdown(7990), { base: 6771, igv: 1219, total: 7990 });
      assert.deepEqual(igvBreakdown(14990), { base: 12703, igv: 2287, total: 14990 });
    });
    await test("RUC: valida longitud, prefijo y dígito verificador", () => {
      assert.equal(isValidRuc("20100070970"), true);
      assert.equal(isValidRuc("20100070971"), false);
      assert.equal(isValidRuc("99100070970"), false);
      assert.equal(isValidRuc("2010007097"), false);
    });
    await test("Comprobante: factura con RUC válido y numeración correlativa", async () => {
      const user = actor();
      await assert.rejects(buy(user, { type: "factura", documentNumber: "20100070971", legalName: "Empresa" }), (e: unknown) => e instanceof PaymentError && e.status === 400);
      const first = await buy(user, { type: "factura", documentNumber: "20100070970", legalName: "Empresa SAC" });
      const second = await buy(user, { type: "factura", documentNumber: "20100070970", legalName: "Empresa SAC" });
      assert.equal(first.payment.receipt?.type, "factura");
      assert.match(first.payment.receipt!.number, /^F001-\d{8}$/);
      assert.equal(Number(second.payment.receipt!.number.slice(5)), Number(first.payment.receipt!.number.slice(5)) + 1);
      const receipt = service.receipt(user, first.payment.id)!;
      assert.equal(receipt.customerName, "Empresa SAC");
      assert.equal(receipt.base + receipt.igv, receipt.total);
      assert.equal(service.receipt(actor(), first.payment.id), null);
    });
    await test("Comprobante: boleta sin DNI usa el nombre del comprador", async () => {
      const user = actor();
      const { payment } = await buy(user, { type: "boleta", documentNumber: "", legalName: "" });
      const receipt = service.receipt(user, payment.id)!;
      assert.match(receipt.number, /^B001-/);
      assert.equal(receipt.documentNumber, null);
      assert.equal(receipt.customerName, "Ana Prueba");
    });
    await test("Pago rechazado: no genera comprobante", async () => {
      const user = actor();
      const { payment } = await service.checkout(user, {
        provider: "demo", planId: "pro", requestId: randomUUID(), acceptedTerms: true, legalVersion: BILLING_TERMS_VERSION, invoice: { type: "boleta", documentNumber: "", legalName: "" },
        buyer: { firstName: "Ana", lastName: "Prueba", email: "ana@example.com", phone: "900000001" },
      });
      const result = await service.simulate(user, payment.id, { outcome: "failed", method: "Yape" });
      assert.equal(result.payment.receipt, null);
    });
    await test("Límites: la prueba gratuita bloquea y un plan la amplía", async () => {
      const user = actor();
      for (let i = 0; i < 4; i++) analysis(user.companyId);
      analysis(user.companyId, "failed");
      assert.equal(limitError(db, user.companyId, "priceAnalyses"), null);
      analysis(user.companyId, "queued");
      assert.match(limitError(db, user.companyId, "priceAnalyses")!, /Prueba gratuita incluye 5/);
      await buy(user, { type: "boleta", documentNumber: "", legalName: "" });
      assert.equal(limitsOf(db, user.companyId).name, "Pro");
      assert.equal(limitError(db, user.companyId, "priceAnalyses"), null);
    });
    await test("Límites: se pueden desactivar por configuración", () => {
      const user = actor();
      for (let i = 0; i < 6; i++) analysis(user.companyId);
      assert.ok(limitError(db, user.companyId, "priceAnalyses"));
      process.env.COMPA_ENFORCE_PLAN_LIMITS = "0";
      assert.equal(limitError(db, user.companyId, "priceAnalyses"), null);
      delete process.env.COMPA_ENFORCE_PLAN_LIMITS;
    });
    await test("Anomalías: separa el precio muy bajo y no altera el promedio", () => {
      const { clean, flagged } = splitAnomalies([offer(40), offer(100), offer(110), offer(120)]);
      assert.deepEqual(flagged.map((o) => o.price), [40]);
      assert.equal(computeStats(100, "PEN", clean.map((o) => o.price))!.min, 100);
    });
    await test("Anomalías: no marca con pocas ofertas ni variaciones normales", () => {
      assert.equal(splitAnomalies([offer(10), offer(100), offer(110)]).flagged.length, 0);
      assert.equal(splitAnomalies([offer(70), offer(100), offer(110), offer(120)]).flagged.length, 0);
    });
    await test("Aviso de retiro: descarta el dominio excluido y sus subdominios", () => {
      process.env.COMPA_EXCLUDED_DOMAINS = "retirada.pe";
      const { kept, dropped } = normalizeOffers([offer(100, "https://www.retirada.pe/a"), offer(101, "https://shop.retirada.pe/a"), offer(102, "https://noretirada.pe/a")], "PEN");
      delete process.env.COMPA_EXCLUDED_DOMAINS;
      assert.equal(dropped.excluded, 2);
      assert.deepEqual(kept.map((o) => o.price), [102]);
    });
    await test("Minimización: retira datos personales y conserva cifras de negocio", () => {
      const out = redactPersonalData("Gerente ana@empresa.pe, cel 987 654 321, DNI: 12345678. Ventas 987654321.50 y stock 45678901.");
      assert.equal(out.includes("ana@empresa.pe"), false);
      assert.equal(out.includes("987 654 321"), false);
      assert.equal(out.includes("12345678"), false);
      assert.ok(out.includes("987654321.50"));
      assert.ok(out.includes("45678901"));
    });
    await test("Consentimiento: se registra una vez por versión", () => {
      const user = actor();
      assert.equal(account.currentConsent(user.userId), null);
      account.recordConsent(user.userId); account.recordConsent(user.userId);
      assert.ok(account.currentConsent(user.userId));
    });
    await test("Exportación: incluye los datos y nunca credenciales", async () => {
      const user = actor();
      await buy(user, { type: "boleta", documentNumber: "", legalName: "" });
      const data = JSON.stringify(account.exportAccount(user.userId, user.companyId));
      assert.ok(data.includes(user.email));
      assert.ok(data.includes("ana@example.com"));
      assert.equal(data.includes(hash), false);
      assert.equal(data.includes("password"), false);
    });
    await test("TOTP: coincide con los vectores de la RFC 6238 y Base32 es reversible", () => {
      const secret = Buffer.from("12345678901234567890");
      assert.equal(totpCode(secret, totpStep(59_000), 8), "94287082");
      assert.equal(totpCode(secret, totpStep(1111111109_000), 8), "07081804");
      assert.equal(base32Encode(secret), "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
      assert.deepEqual(base32Decode(base32Encode(secret)), secret);
    });
    const twoFactorUser = () => {
      const user = actor();
      const u = { id: user.userId, email: user.email };
      const { secret, uri } = twoFactor.startEnrollment(u, password);
      return { user, u, secret, uri, code: (now: number) => totpCode(base32Decode(secret), totpStep(now)) };
    };
    const T = 1_800_000_000_000;
    await test("2FA: no se activa sin un código válido y exige contraseña", () => {
      const user = actor();
      assert.throws(() => twoFactor.startEnrollment({ id: user.userId, email: user.email }, "otra"), /contraseña/);
      const t = twoFactorUser();
      assert.match(t.uri, /^otpauth:\/\/totp\/Compa%3A.+issuer=Compa/);
      assert.throws(() => twoFactor.confirmEnrollment(t.user.userId, "000000", T), /código/);
      assert.equal(twoFactor.secondFactorRequired(t.user.userId), false);
    });
    await test("2FA: el código sirve una sola vez y tolera un intervalo de desfase", () => {
      const t = twoFactorUser();
      assert.equal(twoFactor.confirmEnrollment(t.user.userId, t.code(T), T).length, 8);
      assert.equal(twoFactor.secondFactorRequired(t.user.userId), true);
      assert.equal(twoFactor.verifySecondFactor(t.user.userId, t.code(T), T), false);
      assert.equal(twoFactor.verifySecondFactor(t.user.userId, t.code(T + 30_000), T + 30_000), true);
      assert.equal(twoFactor.verifySecondFactor(t.user.userId, t.code(T + 90_000), T + 60_000), true);
      assert.equal(twoFactor.verifySecondFactor(t.user.userId, t.code(T + 600_000), T + 120_000), false);
      assert.equal(matchTotp(t.secret, "abc", null, T), null);
    });
    await test("2FA: cada código de recuperación se usa una vez", () => {
      const t = twoFactorUser();
      const [first] = twoFactor.confirmEnrollment(t.user.userId, t.code(T), T);
      assert.equal(twoFactor.verifySecondFactor(t.user.userId, first.toUpperCase(), T), true);
      assert.equal(twoFactor.verifySecondFactor(t.user.userId, first, T), false);
      assert.equal(twoFactor.verifySecondFactor(t.user.userId, "ffff-ffff-ffff-ffff", T), false);
      assert.equal(twoFactor.twoFactorStatus(t.user.userId).recoveryLeft, 7);
    });
    await test("2FA: desactivar exige contraseña y código", () => {
      const t = twoFactorUser();
      twoFactor.confirmEnrollment(t.user.userId, t.code(T), T);
      assert.throws(() => twoFactor.disableTwoFactor(t.user.userId, "otra", t.code(T + 30_000), T + 30_000), /contraseña/);
      assert.throws(() => twoFactor.disableTwoFactor(t.user.userId, password, "000000", T + 30_000), /código/);
      twoFactor.disableTwoFactor(t.user.userId, password, t.code(T + 30_000), T + 30_000);
      assert.equal(twoFactor.secondFactorRequired(t.user.userId), false);
      assert.equal(twoFactor.twoFactorStatus(t.user.userId).recoveryLeft, 0);
    });
    await test("2FA: el secreto queda cifrado y ligado a su usuario", () => {
      const t = twoFactorUser();
      const stored = (db.prepare("SELECT totp_secret FROM users WHERE id = ?").get(t.user.userId) as { totp_secret: string }).totp_secret;
      assert.match(stored, /^v1:/);
      assert.equal(stored.includes(t.secret), false);
      assert.equal(openSecret(stored, t.user.userId), t.secret);
      assert.equal(openSecret(stored, t.user.userId + 1), null);
      const [, iv, tag, data] = stored.split(":");
      assert.equal(openSecret(["v1", iv, tag, Buffer.from("alterado").toString("base64") + data.slice(12)].join(":"), t.user.userId), null);
    });
    await test("2FA: sin llave no se activa y con otra llave solo sirve un código de recuperación", () => {
      const t = twoFactorUser();
      const [recovery] = twoFactor.confirmEnrollment(t.user.userId, t.code(T), T);
      const key = process.env.COMPA_TOTP_KEY;
      process.env.COMPA_TOTP_KEY = randomBytes(32).toString("base64");
      assert.equal(twoFactor.verifySecondFactor(t.user.userId, t.code(T + 30_000), T + 30_000), false);
      assert.equal(twoFactor.verifySecondFactor(t.user.userId, recovery, T + 30_000), true);
      delete process.env.COMPA_TOTP_KEY;
      const other = actor();
      assert.throws(() => twoFactor.startEnrollment({ id: other.userId, email: other.email }, password), /no está configurada/);
      process.env.COMPA_TOTP_KEY = key;
    });
    await test("2FA: la cuenta demo puede activarlo y el secreto no se exporta", () => {
      const demo = demoActor();
      assert.ok(twoFactor.startEnrollment({ id: demo.userId, email: demo.email }, password).secret);
      const t = twoFactorUser();
      twoFactor.confirmEnrollment(t.user.userId, t.code(T), T);
      assert.equal(JSON.stringify(account.exportAccount(t.user.userId, t.user.companyId)).includes(t.secret), false);
      account.deleteAccount({ id: t.user.userId, email: t.user.email, company_id: t.user.companyId }, password);
      const left = db.prepare("SELECT totp_secret FROM users WHERE id = ?").get(t.user.userId) as { totp_secret: string | null };
      assert.equal(left.totp_secret, null);
      assert.equal(db.prepare("SELECT 1 FROM user_recovery_codes WHERE user_id = ?").get(t.user.userId), undefined);
    });
    const session = (u: BillingActor) => ({ id: u.userId, email: u.email, company_id: u.companyId });
    await test("Eliminación: exige contraseña y protege la cuenta demo", () => {
      const user = actor();
      assert.throws(() => account.deleteAccount(session(user), "otra"), /contraseña/);
      const demo = demoActor();
      assert.throws(() => account.deleteAccount(session(demo), password), /protegida/);
      assert.ok(db.prepare("SELECT 1 FROM users WHERE id = ? AND email = ?").get(demo.userId, account.DEMO_EMAIL));
    });
    await test("Eliminación: borra lo personal y conserva el comprobante", async () => {
      const user = actor();
      analysis(user.companyId);
      const { payment } = await buy(user, { type: "boleta", documentNumber: "", legalName: "" });
      account.deleteAccount(session(user), password);
      const row = db.prepare("SELECT email, name FROM users WHERE id = ?").get(user.userId) as { email: string; name: string };
      assert.match(row.email, /@compa\.invalid$/);
      assert.equal(row.name, "Cuenta eliminada");
      assert.equal((db.prepare("SELECT COUNT(*) n FROM products WHERE company_id = ?").get(user.companyId) as { n: number }).n, 0);
      assert.equal((db.prepare("SELECT COUNT(*) n FROM analyses WHERE company_id = ?").get(user.companyId) as { n: number }).n, 0);
      assert.equal(String((db.prepare("SELECT buyer FROM billing_payments WHERE id = ?").get(payment.id) as { buyer: string }).buyer).includes("ana@example.com"), false);
      assert.ok(service.receipt(user, payment.id));
    });
    await test("Eliminación: con otros usuarios se conserva la empresa", () => {
      const user = actor();
      analysis(user.companyId);
      db.prepare("INSERT INTO users(company_id,email,password_hash,name) VALUES (?,?,?,'Otro')").run(user.companyId, `otro-${user.companyId}@example.com`, hash);
      assert.equal(account.deleteAccount(session(user), password).companyErased, false);
      assert.equal((db.prepare("SELECT COUNT(*) n FROM products WHERE company_id = ?").get(user.companyId) as { n: number }).n, 1);
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

void main();
