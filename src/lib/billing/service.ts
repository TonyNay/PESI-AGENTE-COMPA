import crypto from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import {
  BILLING_TERMS_VERSION, findBillingPlan, igvBreakdown, isValidRuc, REFUND_MAX_ANALYSES, REFUND_WINDOW_DAYS, soles,
  type BillingBuyer, type BillingInvoice, type BillingOverview, type CreditNote,
  type BillingPlanId, type CheckoutResult, type InvoiceType, type PaymentEvent, type PaymentMode,
  type PaymentResult, type PaymentState, type PaymentSummary, type Receipt, type ReceiptSummary,
} from "./catalog";
import { billingConfiguration, PaymentError } from "./config";
import { limitsOf, renewalNotice, usageOf } from "./limits";
import { writeAudit } from "../audit";
import { ensureReferralSchema, revokeReferralReward, rewardReferral } from "../referrals";

export interface BillingActor { companyId: number; userId: number; name: string; email: string; role: string }
interface PaymentRow {
  id: string; company_id: number; user_id: number; plan_id: BillingPlanId; amount: number; days: number;
  provider: "culqi" | "demo"; mode: PaymentMode; status: PaymentState; request_key: string; buyer: string;
  remote_order_id: string | null; transaction_id: string | null; method: string | null; message: string | null;
  created_at: number; expires_at: number; paid_at: number | null; invoice: string | null;
}
interface ReceiptRow {
  payment_id: string; company_id: number; series: string; number: number; type: InvoiceType; document_number: string | null;
  customer_name: string; base: number; igv: number; total: number; issued_at: number;
}
interface CreditNoteRow {
  payment_id: string; company_id: number; series: string; number: number; reference: string; reason: string;
  base: number; igv: number; total: number; issued_at: number;
}
interface Attempt { source_id: string; payment_id: string; device_id: string; state: string; charge_id: string | null }
interface Resource {
  object?: string; id?: string; amount?: number; currency_code?: string; order_number?: string;
  state?: string; capture?: boolean; amount_refunded?: number; current_amount?: number;
  source?: { id?: string }; source_id?: string; metadata?: { compa_payment?: string }; user_message?: string;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS billing_payments (
  id TEXT PRIMARY KEY, company_id INTEGER NOT NULL REFERENCES companies(id), user_id INTEGER NOT NULL REFERENCES users(id),
  plan_id TEXT NOT NULL, amount INTEGER NOT NULL, days INTEGER NOT NULL, provider TEXT NOT NULL, mode TEXT NOT NULL,
  status TEXT NOT NULL, request_key TEXT NOT NULL, buyer TEXT NOT NULL, terms_version TEXT NOT NULL,
  remote_order_id TEXT UNIQUE, transaction_id TEXT, method TEXT, message TEXT,
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, paid_at INTEGER,
  UNIQUE(company_id, request_key)
);
CREATE INDEX IF NOT EXISTS billing_company ON billing_payments(company_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS billing_transaction ON billing_payments(provider, transaction_id) WHERE transaction_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS billing_attempts (
  source_id TEXT PRIMARY KEY, payment_id TEXT NOT NULL REFERENCES billing_payments(id),
  device_id TEXT NOT NULL, state TEXT NOT NULL, charge_id TEXT UNIQUE, created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS billing_active_attempt ON billing_attempts(payment_id) WHERE state IN ('processing','requires_3ds','unknown');
CREATE TABLE IF NOT EXISTS billing_memberships (
  company_id INTEGER NOT NULL REFERENCES companies(id), mode TEXT NOT NULL, plan_id TEXT NOT NULL,
  active_until INTEGER NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY(company_id, mode)
);
CREATE TABLE IF NOT EXISTS billing_buyers (
  user_id INTEGER PRIMARY KEY REFERENCES users(id), first_name TEXT NOT NULL, last_name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS billing_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, payment_id TEXT NOT NULL REFERENCES billing_payments(id),
  state TEXT NOT NULL, message TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS billing_rate_limits (key TEXT PRIMARY KEY, hits INTEGER NOT NULL, resets_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS billing_receipts (
  payment_id TEXT PRIMARY KEY REFERENCES billing_payments(id), company_id INTEGER NOT NULL REFERENCES companies(id),
  series TEXT NOT NULL, number INTEGER NOT NULL, type TEXT NOT NULL, document_number TEXT, customer_name TEXT NOT NULL,
  base INTEGER NOT NULL, igv INTEGER NOT NULL, total INTEGER NOT NULL, issued_at INTEGER NOT NULL, UNIQUE(series, number)
);
CREATE TABLE IF NOT EXISTS billing_refunds (
  payment_id TEXT PRIMARY KEY REFERENCES billing_payments(id), state TEXT NOT NULL, remote_id TEXT, reason TEXT NOT NULL,
  amount INTEGER NOT NULL, requested_by INTEGER, created_at INTEGER NOT NULL, refunded_at INTEGER
);
CREATE TABLE IF NOT EXISTS billing_credit_notes (
  payment_id TEXT PRIMARY KEY REFERENCES billing_payments(id), company_id INTEGER NOT NULL REFERENCES companies(id),
  series TEXT NOT NULL, number INTEGER NOT NULL, reference TEXT NOT NULL, reason TEXT NOT NULL,
  base INTEGER NOT NULL, igv INTEGER NOT NULL, total INTEGER NOT NULL, issued_at INTEGER NOT NULL, UNIQUE(series, number)
);
`;

const name = z.string().trim().min(2).max(50).regex(/^[\p{L}\p{M} .'-]+$/u);
const buyerSchema = z.object({
  firstName: name, lastName: name, email: z.email().max(50),
  phone: z.string().trim().transform((v) => v.replace(/[\s()-]/g, "").replace(/^\+?51/, "")).pipe(z.string().regex(/^9\d{8}$/)),
});
const invoiceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("boleta"), documentNumber: z.string().trim().regex(/^(\d{8})?$/), legalName: z.string().optional() }),
  z.object({ type: z.literal("factura"), documentNumber: z.string().trim().refine(isValidRuc), legalName: z.string().trim().min(2).max(120) }),
]);
const checkoutSchema = z.object({
  planId: z.enum(["emprendedor", "pro", "empresa"]), provider: z.enum(["culqi", "demo"]),
  requestId: z.uuid(), buyer: buyerSchema, invoice: invoiceSchema, acceptedTerms: z.literal(true), legalVersion: z.literal(BILLING_TERMS_VERSION),
});
const refundSchema = z.object({ reason: z.string().trim().min(5).max(300) });
const chargeSchema = z.object({
  tokenId: z.string().regex(/^(?:tkn|ype)_test_[A-Za-z0-9]{8,40}$/), deviceId: z.string().regex(/^[A-Za-z0-9-]{8,100}$/),
  authentication3DS: z.object({
    eci: z.string().min(1).max(10), cavv: z.string().min(1).max(1024), xid: z.string().max(1024).optional(),
    protocolVersion: z.string().min(1).max(20), directoryServerTransactionId: z.string().max(100).optional(),
  }).optional(),
});
const remoteId = (kind: string, value: unknown) => typeof value === "string" && new RegExp(`^${kind}_test_[A-Za-z0-9]{8,40}$`).test(value);
const DAY = 86_400_000;
const receiptNumber = (r: Pick<ReceiptRow, "series" | "number">) => `${r.series}-${String(r.number).padStart(8, "0")}`;

const prepared = new WeakSet<DatabaseSync>();
/** Crea las tablas de pagos una sola vez por conexión; también las usan los límites y la cuenta. */
export function ensureBillingSchema(db: DatabaseSync) {
  if (prepared.has(db)) return;
  db.exec(SCHEMA);
  const columns = db.prepare("PRAGMA table_info(billing_payments)").all().map((c) => String(c.name));
  if (!columns.includes("invoice")) db.exec("ALTER TABLE billing_payments ADD COLUMN invoice TEXT");
  ensureReferralSchema(db);
  prepared.add(db);
}

/** Servicio con base y transporte inyectables: permite pruebas completas sin cobrar ni abrir puertos. */
export function createBillingService(db: DatabaseSync, fetcher: typeof fetch = globalThis.fetch) {
  ensureBillingSchema(db);
  const one = <T>(sql: string, ...values: (string | number | null)[]) => {
    const row = db.prepare(sql).get(...values); return row ? { ...row } as T : undefined;
  };
  const many = <T>(sql: string, ...values: (string | number | null)[]) => db.prepare(sql).all(...values).map((r) => ({ ...r })) as T[];
  const event = (id: string, state: string, message: string) => db.prepare("INSERT INTO billing_events (payment_id,state,message,created_at) VALUES (?,?,?,?)").run(id, state, message, Date.now());
  const atomic = <T>(fn: () => T): T => {
    db.exec("BEGIN IMMEDIATE");
    try { const value = fn(); db.exec("COMMIT"); return value; }
    catch (error) { db.exec("ROLLBACK"); throw error; }
  };
  function row(id: string, companyId?: number): PaymentRow {
    const p = one<PaymentRow>("SELECT * FROM billing_payments WHERE id = ?", id);
    if (!p || (companyId !== undefined && p.company_id !== companyId)) throw new PaymentError("Compra no encontrada.", 404);
    return p;
  }
  function summary(p: PaymentRow): PaymentSummary {
    return { id: p.id, planId: p.plan_id, planName: findBillingPlan(p.plan_id)!.name, amount: p.amount, currency: "PEN", provider: p.provider,
      mode: p.mode, status: p.status, method: p.method, transactionId: p.transaction_id, message: p.message,
      createdAt: p.created_at, expiresAt: p.expires_at, paidAt: p.paid_at, receipt: receiptSummary(p.id),
      creditNote: creditNoteSummary(p.id),
      refundable: p.status === "paid" && p.paid_at !== null && Date.now() - p.paid_at <= REFUND_WINDOW_DAYS * DAY };
  }
  function creditNoteRow(paymentId: string) {
    return one<CreditNoteRow>("SELECT * FROM billing_credit_notes WHERE payment_id = ?", paymentId);
  }
  function creditNoteSummary(paymentId: string) {
    const n = creditNoteRow(paymentId);
    return n ? { number: receiptNumber(n) } : null;
  }
  function receiptSummary(paymentId: string): ReceiptSummary | null {
    const r = one<ReceiptRow>("SELECT * FROM billing_receipts WHERE payment_id = ?", paymentId);
    return r ? { number: receiptNumber(r), type: r.type } : null;
  }
  /** Representación de demostración; se genera en la misma transacción que activa el plan. */
  function issueReceipt(p: PaymentRow, now: number) {
    if (!p.invoice) return;
    const invoice = JSON.parse(p.invoice) as BillingInvoice;
    const buyer = JSON.parse(p.buyer) as BillingBuyer;
    const series = invoice.type === "factura" ? "F001" : "B001";
    const next = (one<{ n: number }>("SELECT COALESCE(MAX(number), 0) AS n FROM billing_receipts WHERE series = ?", series)?.n ?? 0) + 1;
    const { base, igv, total } = igvBreakdown(p.amount);
    db.prepare("INSERT INTO billing_receipts VALUES (?,?,?,?,?,?,?,?,?,?,?)").run(p.id, p.company_id, series, next, invoice.type, invoice.documentNumber || null,
      invoice.type === "factura" ? invoice.legalName : `${buyer.firstName} ${buyer.lastName}`, base, igv, total, now);
  }
  const update = (id: string, state: PaymentState, message: string | null = null) => {
    db.prepare("UPDATE billing_payments SET status = ?, message = ? WHERE id = ? AND status != 'paid'").run(state, message, id);
  };
  function canBuy(actor: BillingActor) {
    if (actor.role !== "admin") throw new PaymentError("Solo un administrador de tu empresa puede comprar un plan.", 403);
  }
  function requireCulqi() {
    const c = billingConfiguration();
    if (!c.enabled) throw new PaymentError(c.message ?? "Culqi no está configurado.", 503);
    return c;
  }
  function requireSimulator() {
    if (!billingConfiguration().simulatorEnabled) throw new PaymentError("El simulador local está deshabilitado.", 404);
  }
  async function api(path: string, body?: unknown) {
    const config = requireCulqi();
    let response: Response;
    try {
      response = await fetcher(`https://api.culqi.com/v2${path}`, {
        method: body === undefined ? "GET" : "POST", cache: "no-store",
        headers: { authorization: `Bearer ${config.secretKey}`, "content-type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(20_000),
      });
    } catch { throw new PaymentError("No se recibió la confirmación de Culqi. Consulta el estado antes de intentar otro pago.", 502, true); }
    const data = await response.json().catch(() => null) as Resource | null;
    if (!data || typeof data !== "object") throw new PaymentError("La respuesta de Culqi está incompleta. Consulta el estado de tu compra.", 502, true);
    const challenge = path === "/charges" && response.status === 200;
    if (!response.ok || (data.object === "error" && !challenge)) {
      console.warn("[compa-pagos] Culqi", response.status, response.headers.get("x-culqi-tracking-id"));
      throw new PaymentError(data.user_message?.slice(0, 300) || "Culqi no pudo procesar la operación.", response.status >= 500 ? 502 : 400, response.status >= 500);
    }
    return { status: response.status, data };
  }
  function validateAmount(p: PaymentRow, data: Resource) {
    if (data.amount !== p.amount || data.currency_code !== "PEN") throw new PaymentError("El importe o moneda no coincide con la compra.", 409);
  }
  function checkoutResult(p: PaymentRow): CheckoutResult {
    const buyer = JSON.parse(p.buyer) as BillingBuyer;
    return { payment: summary(p), checkout: p.provider !== "culqi" || p.status === "paid" ? null : {
      publicKey: requireCulqi().publicKey, orderId: p.remote_order_id!, amount: p.amount, currency: "PEN", expiresAt: p.expires_at,
      client: { email: buyer.email, firstName: buyer.firstName, lastName: buyer.lastName },
      paymentMethods: { tarjeta: true, yape: true, billetera: p.amount >= 600 && p.amount <= 50_000, bancaMovil: true, agente: true, cuotealo: p.amount >= 10_000 },
    } };
  }

  function fulfill(id: string, provider: "culqi" | "demo", amount: number, transactionId: string, method: string): PaymentResult {
    return atomic(() => {
      const p = row(id);
      if (p.provider !== provider || p.amount !== amount) throw new PaymentError("El pago no corresponde a esta compra.", 409);
      if (p.status === "refunded") throw new PaymentError("Esta compra fue reembolsada y no puede volver a activarse.", 409);
      if (p.status === "paid") {
        if (p.transaction_id !== transactionId) {
          console.error("[compa-pagos] Revisar cobro adicional para orden", p.id, transactionId);
          throw new PaymentError("Esta compra ya tiene otro pago. Contacta al administrador para revisar el cobro adicional.", 409);
        }
        return { paid: true, payment: summary(p) };
      }
      const used = one<{ id: string }>("SELECT id FROM billing_payments WHERE provider = ? AND transaction_id = ?", provider, transactionId);
      if (used) throw new PaymentError("La transacción ya pertenece a otra compra.", 409);
      const now = Date.now();
      const membership = one<{ active_until: number }>("SELECT active_until FROM billing_memberships WHERE company_id = ? AND mode = ?", p.company_id, p.mode);
      const until = Math.max(now, membership?.active_until ?? 0) + p.days * DAY;
      db.prepare("UPDATE billing_payments SET status = 'paid', transaction_id = ?, method = ?, paid_at = ?, message = NULL WHERE id = ?").run(transactionId, method, now, id);
      db.prepare(`INSERT INTO billing_memberships VALUES (?,?,?,?,?) ON CONFLICT(company_id,mode)
        DO UPDATE SET plan_id=excluded.plan_id, active_until=excluded.active_until, updated_at=excluded.updated_at`).run(p.company_id, p.mode, p.plan_id, until, now);
      issueReceipt(p, now);
      event(id, "paid", provider === "culqi" ? "Pago de prueba confirmado por Culqi; plan activado." : "Aprobación simulada localmente; plan de demostración activado.");
      writeAudit(db, { action: "billing.paid", companyId: p.company_id, userId: p.user_id, detail: `Plan ${findBillingPlan(p.plan_id)!.name} · ${soles(p.amount)} · ${method} · ${p.mode}` });
      const referrer = rewardReferral(db, p.company_id, p.mode, p.id, now);
      if (referrer) writeAudit(db, { action: "referral.reward", companyId: referrer, detail: `+31 días por el primer pago de una empresa invitada (${p.mode})` });
      return { paid: true, payment: summary(row(id)) };
    });
  }

  async function checkout(actor: BillingActor, input: unknown): Promise<CheckoutResult> {
    canBuy(actor);
    const parsed = checkoutSchema.safeParse(input);
    if (!parsed.success) throw new PaymentError("Revisa el plan, los datos del comprador y la aceptación de las condiciones.");
    const b = parsed.data;
    if (b.provider === "culqi") requireCulqi(); else requireSimulator();
    const plan = findBillingPlan(b.planId)!;
    const now = Date.now();
    const existing = atomic(() => {
      const previous = one<PaymentRow>("SELECT * FROM billing_payments WHERE company_id = ? AND request_key = ?", actor.companyId, b.requestId);
      if (previous) return previous;
      const id = `CP${now.toString(36)}${crypto.randomBytes(6).toString("hex")}`.toUpperCase();
      db.prepare(`INSERT INTO billing_payments
        (id,company_id,user_id,plan_id,amount,days,provider,mode,status,request_key,buyer,invoice,terms_version,created_at,expires_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, actor.companyId, actor.userId, plan.id, plan.amount, plan.days, b.provider,
          b.provider === "culqi" ? "TEST" : "SIMULATED", "creating", b.requestId, JSON.stringify(b.buyer), JSON.stringify(b.invoice), BILLING_TERMS_VERSION, now, now + 30 * 60_000);
      return null;
    });
    if (existing) {
      if (existing.plan_id !== plan.id || existing.provider !== b.provider) throw new PaymentError("La referencia ya se utilizó para otra compra.", 409);
      return resume(actor, existing.id);
    }
    const p = one<PaymentRow>("SELECT * FROM billing_payments WHERE company_id = ? AND request_key = ?", actor.companyId, b.requestId)!;
    db.prepare(`INSERT INTO billing_buyers VALUES (?,?,?,?,?) ON CONFLICT(user_id)
      DO UPDATE SET first_name=excluded.first_name,last_name=excluded.last_name,email=excluded.email,phone=excluded.phone`).run(actor.userId, b.buyer.firstName, b.buyer.lastName, b.buyer.email, b.buyer.phone);
    if (p.provider === "demo") {
      update(p.id, "pending"); event(p.id, "pending", "Orden simulada creada. No se contactó a Culqi ni al banco.");
      return checkoutResult(row(p.id));
    }
    try {
      const { data } = await api("/orders", {
        amount: p.amount, currency_code: "PEN", description: `Compa - Plan ${plan.name}`, order_number: p.id,
        expiration_date: Math.floor(p.expires_at / 1000), confirm: false,
        client_details: { first_name: b.buyer.firstName, last_name: b.buyer.lastName, email: b.buyer.email, phone_number: b.buyer.phone },
        metadata: { compa_payment: p.id },
      });
      validateAmount(p, data);
      if (data.object !== "order" || !remoteId("ord", data.id) || data.order_number !== p.id) throw new PaymentError("Culqi no devolvió una orden válida.", 502);
      db.prepare("UPDATE billing_payments SET remote_order_id = ?, status = 'pending' WHERE id = ?").run(data.id!, p.id);
      event(p.id, "pending", "Orden de Culqi creada. Esperando el pago de prueba.");
      return checkoutResult(row(p.id));
    } catch (error) {
      update(p.id, "failed", error instanceof PaymentError ? error.message : "No se pudo preparar el pago.");
      event(p.id, "failed", "No se pudo preparar la orden en Culqi. No se envió un cargo.");
      throw error;
    }
  }

  async function resume(actor: BillingActor, id: string): Promise<CheckoutResult> {
    canBuy(actor);
    const p = row(id, actor.companyId);
    if (p.provider === "culqi") requireCulqi(); else requireSimulator();
    if (p.status === "paid") return checkoutResult(p);
    if (p.status !== "pending" || p.expires_at <= Date.now()) throw new PaymentError("La orden no está disponible para continuar. Consulta su estado o inicia una compra nueva.", 409);
    if (p.provider === "culqi" && !p.remote_order_id) throw new PaymentError("La orden todavía se está preparando.", 409);
    // Reabrir el checkout reinicia un desafío abandonado, nunca un cargo enviado o incierto.
    cancelAuthentication(actor, id);
    return checkoutResult(p);
  }

  async function verifyCharge(chargeId: string): Promise<PaymentResult> {
    if (!remoteId("chr", chargeId)) throw new PaymentError("Cargo de prueba inválido.");
    // Una notificación tardía de un cargo ya devuelto no debe reactivar ni fallar.
    const known = one<{ payment_id: string }>("SELECT payment_id FROM billing_attempts WHERE charge_id = ?", chargeId);
    if (known && row(known.payment_id).status === "refunded") return { paid: false, payment: summary(row(known.payment_id)) };
    const { data } = await api(`/charges/${chargeId}`);
    if (data.object !== "charge" || data.id !== chargeId || data.capture !== true) throw new PaymentError("Culqi aún no confirmó un cargo capturado.", 409);
    if ((data.amount_refunded ?? 0) > 0 || (data.current_amount !== undefined && data.current_amount !== data.amount)) throw new PaymentError("El cargo tiene una devolución y requiere revisión.", 409);
    const source = data.source?.id ?? data.source_id;
    const attempt = source ? one<Attempt>("SELECT * FROM billing_attempts WHERE source_id = ?", source) : undefined;
    if (!attempt || data.metadata?.compa_payment !== attempt.payment_id) throw new PaymentError("El cargo no corresponde a una compra de Compa.", 403);
    const p = row(attempt.payment_id);
    if (p.provider !== "culqi" || p.mode !== "TEST") throw new PaymentError("El cargo pertenece a otro entorno.", 409);
    validateAmount(p, data);
    const result = fulfill(p.id, "culqi", data.amount!, data.id!, source!.startsWith("ype_") ? "Yape" : "Tarjeta");
    db.prepare("UPDATE billing_attempts SET state = 'paid', charge_id = ? WHERE source_id = ?").run(chargeId, source!);
    return result;
  }

  async function charge(actor: BillingActor, id: string, input: unknown): Promise<PaymentResult> {
    canBuy(actor); requireCulqi();
    const p = row(id, actor.companyId);
    if (p.provider !== "culqi" || p.mode !== "TEST") throw new PaymentError("Esta compra no es de Culqi test.", 409);
    if (p.status === "paid") return { paid: true, payment: summary(p) };
    if (p.status !== "pending" || p.expires_at <= Date.now()) throw new PaymentError("La orden venció o ya no está disponible.", 409);
    const parsed = chargeSchema.safeParse(input);
    if (!parsed.success) throw new PaymentError("El token o los datos de autenticación no son válidos.");
    const b = parsed.data;
    atomic(() => {
      if (row(id).status === "paid") throw new PaymentError("La compra ya fue pagada. Consulta su estado.", 409);
      const previous = one<Attempt>("SELECT * FROM billing_attempts WHERE source_id = ?", b.tokenId);
      if (previous) {
        if (previous.payment_id !== p.id) throw new PaymentError("El token pertenece a otra compra.", 409);
        if (previous.state !== "requires_3ds" || !b.authentication3DS || previous.device_id !== b.deviceId) throw new PaymentError("Este intento ya fue enviado. Consulta el estado antes de volver a pagar.", 409);
        db.prepare("UPDATE billing_attempts SET state = 'processing' WHERE source_id = ?").run(b.tokenId);
      } else {
        if (b.authentication3DS) throw new PaymentError("No hay una autenticación pendiente para este token.");
        if (one("SELECT 1 FROM billing_attempts WHERE payment_id = ? AND state IN ('processing','requires_3ds','unknown')", p.id)) throw new PaymentError("Ya hay un pago pendiente de confirmación para esta orden.", 409);
        db.prepare("INSERT INTO billing_attempts VALUES (?,?,?,'processing',NULL,?)").run(b.tokenId, p.id, b.deviceId, Date.now());
      }
    });
    const buyer = JSON.parse(p.buyer) as BillingBuyer;
    let result;
    try {
      result = await api("/charges", {
        amount: p.amount, currency_code: "PEN", source_id: b.tokenId, email: buyer.email, capture: true,
        description: `Compa - Plan ${findBillingPlan(p.plan_id)!.name}`, metadata: { compa_payment: p.id },
        antifraud_details: { first_name: buyer.firstName, last_name: buyer.lastName, phone_number: buyer.phone, device_finger_print_id: b.deviceId },
        ...(b.authentication3DS ? { authentication_3DS: b.authentication3DS } : {}),
      });
    } catch (error) {
      const uncertain = !(error instanceof PaymentError) || error.uncertain;
      db.prepare("UPDATE billing_attempts SET state = ? WHERE source_id = ? AND state = 'processing'").run(uncertain ? "unknown" : "failed", b.tokenId);
      const message = uncertain ? "Respuesta del cargo pendiente de verificación. No se enviará otro cargo automáticamente." : "Intento rechazado. Puedes probar otro medio de pago.";
      db.prepare("UPDATE billing_payments SET message = ? WHERE id = ? AND status != 'paid'").run(message, id);
      event(id, uncertain ? "verification" : "declined", message);
      throw error;
    }
    const { data, status } = result;
    if (data.object === "charge" && remoteId("chr", data.id) && data.capture === true) {
      db.prepare("UPDATE billing_attempts SET state = 'unknown', charge_id = ? WHERE source_id = ?").run(data.id!, b.tokenId);
      return verifyCharge(data.id!);
    }
    if (status === 200 && !b.authentication3DS && b.tokenId.startsWith("tkn_")) {
      db.prepare("UPDATE billing_attempts SET state = 'requires_3ds' WHERE source_id = ?").run(b.tokenId);
      event(id, "requires_3ds", "El banco solicita autenticación 3DS.");
      return { paid: false, requires3DS: true, payment: summary(row(id)) };
    }
    db.prepare("UPDATE billing_attempts SET state = 'unknown' WHERE source_id = ?").run(b.tokenId);
    throw new PaymentError("El cargo necesita verificación. Consulta el estado antes de volver a pagar.", 409, true);
  }

  async function reconcile(id: string): Promise<PaymentResult> {
    const p = row(id);
    if (p.status === "refunded") return { paid: false, payment: summary(p) };
    if (p.provider === "demo" && p.status === "pending" && p.expires_at <= Date.now()) {
      update(id, "expired"); event(id, "expired", "La orden simulada venció sin aprobación.");
      return { paid: false, payment: summary(row(id)) };
    }
    if (p.status === "paid" || p.provider === "demo" || !p.remote_order_id) return { paid: p.status === "paid", payment: summary(p) };
    const attempt = one<Attempt>("SELECT * FROM billing_attempts WHERE payment_id = ? AND state IN ('processing','requires_3ds','unknown')", id);
    if (attempt?.charge_id) return verifyCharge(attempt.charge_id);
    const { data } = await api(`/orders/${p.remote_order_id}`);
    if (data.object !== "order" || data.id !== p.remote_order_id || data.order_number !== p.id) throw new PaymentError("La orden de Culqi no coincide con la compra.", 409);
    validateAmount(p, data);
    if (data.state === "paid") return fulfill(id, "culqi", data.amount!, data.id!, "QR / PagoEfectivo / Cuotéalo");
    if (data.state === "expired" || data.state === "deleted") {
      const state = data.state === "expired" ? "expired" : "cancelled";
      if (p.status !== state) { update(id, state); event(id, state, state === "expired" ? "La orden de Culqi venció." : "La orden fue cancelada en Culqi."); }
    }
    return { paid: false, payment: summary(row(id)) };
  }
  async function status(actor: BillingActor, id: string): Promise<PaymentResult> {
    row(id, actor.companyId);
    const result = await reconcile(id);
    return { ...result, events: many<PaymentEvent>("SELECT id,state,message,created_at AS createdAt FROM billing_events WHERE payment_id = ? ORDER BY id", id) };
  }
  async function webhook(input: unknown) {
    requireCulqi();
    if (!input || typeof input !== "object") throw new PaymentError("Evento inválido.");
    const body = input as Record<string, unknown>;
    let resource = body.data;
    if (typeof resource === "string") { try { resource = JSON.parse(resource); } catch { throw new PaymentError("Evento inválido."); } }
    if (!resource || typeof resource !== "object") throw new PaymentError("El evento no contiene un recurso.");
    const data = resource as Resource;
    if (body.type === "order.status.changed" && remoteId("ord", data.id)) {
      const payment = one<{ id: string }>("SELECT id FROM billing_payments WHERE remote_order_id = ? AND provider = 'culqi'", data.id!);
      return payment ? reconcile(payment.id) : { ignored: true };
    }
    if (body.type === "charge.creation.succeeded" && remoteId("chr", data.id)) return verifyCharge(data.id!);
    return { ignored: true };
  }
  function simulate(actor: BillingActor, id: string, input: unknown): PaymentResult {
    canBuy(actor); requireSimulator();
    const p = row(id, actor.companyId);
    if (p.provider !== "demo" || p.mode !== "SIMULATED") throw new PaymentError("El simulador no puede modificar compras de Culqi.", 403);
    const parsed = z.object({ outcome: z.enum(["paid", "pending", "failed"]), method: z.enum(["Tarjeta", "Yape", "QR", "Banca móvil", "Agentes", "Cuotéalo"]) }).safeParse(input);
    if (!parsed.success) throw new PaymentError("Elige un resultado y un medio de pago válidos.");
    const b = parsed.data;
    if (b.method === "Cuotéalo" && p.amount < 10_000) throw new PaymentError("Cuotéalo requiere un importe mínimo de S/ 100.");
    if (p.status === "paid") return { paid: true, payment: summary(p) };
    if (p.expires_at <= Date.now()) { update(id, "expired"); throw new PaymentError("La orden simulada venció.", 409); }
    if (p.status !== "pending") throw new PaymentError("Inicia una nueva orden para repetir esta simulación.", 409);
    if (b.outcome === "paid") return fulfill(id, "demo", p.amount, `demo_${id}`, b.method);
    const message = b.outcome === "pending" ? "Simulación pendiente; el plan todavía no se activa." : "Pago rechazado en el simulador; no se activó el plan.";
    update(id, b.outcome, message);
    db.prepare("UPDATE billing_payments SET method = ? WHERE id = ?").run(b.method, id);
    event(id, b.outcome, message);
    return { paid: false, payment: summary(row(id)) };
  }
  function cancelAuthentication(actor: BillingActor, id: string) {
    canBuy(actor); row(id, actor.companyId);
    const changes = db.prepare("UPDATE billing_attempts SET state = 'cancelled' WHERE payment_id = ? AND state = 'requires_3ds'").run(id).changes;
    if (changes) event(id, "authentication_cancelled", "La autenticación 3DS se canceló antes de enviar el cargo autenticado.");
    return { ok: true };
  }
  /**
   * Reembolso total dentro de la garantía. Se registra primero la solicitud (evita dos devoluciones
   * simultáneas), luego se pide la devolución a Culqi y, al confirmarse, en una sola transacción:
   * se marca la compra, se descuentan sus días del plan, se emite la nota de crédito y se revierte
   * la recompensa de referidos que hubiera originado.
   */
  async function refund(actor: BillingActor, id: string, input: unknown): Promise<PaymentResult> {
    canBuy(actor);
    const parsed = refundSchema.safeParse(input);
    if (!parsed.success) throw new PaymentError("Indica el motivo del reembolso (de 5 a 300 caracteres).");
    const reason = parsed.data.reason;
    const p = row(id, actor.companyId);
    if (p.status === "refunded") return { paid: false, payment: summary(p) };
    if (p.status !== "paid" || !p.paid_at) throw new PaymentError("Solo se puede reembolsar una compra pagada.", 409);
    const now = Date.now();
    if (now - p.paid_at > REFUND_WINDOW_DAYS * DAY) throw new PaymentError(`El plazo de ${REFUND_WINDOW_DAYS} días para pedir el reembolso ya venció.`, 409);
    const since = new Date(p.paid_at).toISOString();
    const used = (one<{ n: number }>("SELECT COUNT(*) AS n FROM analyses WHERE company_id = ? AND status != 'failed' AND datetime(created_at) >= datetime(?)", p.company_id, since)?.n ?? 0)
      + (one<{ n: number }>("SELECT COUNT(*) AS n FROM strategic_analyses WHERE company_id = ? AND status != 'failed' AND datetime(created_at) >= datetime(?)", p.company_id, since)?.n ?? 0);
    if (used > REFUND_MAX_ANALYSES) throw new PaymentError(`El reembolso procede si usaste hasta ${REFUND_MAX_ANALYSES} análisis desde la compra; llevas ${used}.`, 409);
    atomic(() => {
      const previous = one<{ state: string }>("SELECT state FROM billing_refunds WHERE payment_id = ?", id);
      if (previous && previous.state !== "failed") throw new PaymentError("Ya hay un reembolso en proceso para esta compra. Consulta su estado.", 409);
      if (previous) db.prepare("UPDATE billing_refunds SET state = 'processing', reason = ?, requested_by = ?, created_at = ? WHERE payment_id = ?").run(reason, actor.userId, now, id);
      else db.prepare("INSERT INTO billing_refunds (payment_id,state,reason,amount,requested_by,created_at) VALUES (?,'processing',?,?,?,?)").run(id, reason, p.amount, actor.userId, now);
    });
    let remoteRefund: string;
    if (p.provider === "demo") remoteRefund = `demo_ref_${id}`;
    else {
      const attempt = one<{ charge_id: string | null }>("SELECT charge_id FROM billing_attempts WHERE payment_id = ? AND state = 'paid'", id);
      if (!attempt?.charge_id) {
        db.prepare("UPDATE billing_refunds SET state = 'failed' WHERE payment_id = ?").run(id);
        throw new PaymentError("Este pago se hizo con QR, PagoEfectivo o Cuotéalo y Culqi no permite devolverlo de forma automática. Escríbenos para gestionarlo.", 409);
      }
      try {
        const { data } = await api("/refunds", { amount: p.amount, charge_id: attempt.charge_id, reason: "solicitud_comprador" });
        if (data.object !== "refund" || !remoteId("ref", data.id) || (data.amount !== undefined && data.amount !== p.amount)) throw new PaymentError("Culqi no confirmó la devolución completa.", 502, true);
        remoteRefund = data.id!;
      } catch (error) {
        const uncertain = !(error instanceof PaymentError) || error.uncertain;
        db.prepare("UPDATE billing_refunds SET state = ? WHERE payment_id = ?").run(uncertain ? "unknown" : "failed", id);
        event(id, "refund_failed", uncertain ? "La respuesta de la devolución está pendiente de verificación en Culqi." : "Culqi rechazó la devolución.");
        throw error;
      }
    }
    return atomic(() => {
      const current = row(id);
      if (current.status === "refunded") return { paid: false, payment: summary(current) };
      db.prepare("UPDATE billing_payments SET status = 'refunded', message = ? WHERE id = ?").run(`Reembolsado: ${reason}`, id);
      db.prepare("UPDATE billing_memberships SET active_until = MAX(?, active_until - ?), updated_at = ? WHERE company_id = ? AND mode = ?")
        .run(now, p.days * DAY, now, p.company_id, p.mode);
      const receiptRow = one<ReceiptRow>("SELECT * FROM billing_receipts WHERE payment_id = ?", id);
      if (receiptRow) {
        // Series de notas de crédito: empiezan con F o B según el comprobante que modifican.
        const series = receiptRow.type === "factura" ? "FC01" : "BC01";
        const next = (one<{ n: number }>("SELECT COALESCE(MAX(number), 0) AS n FROM billing_credit_notes WHERE series = ?", series)?.n ?? 0) + 1;
        db.prepare("INSERT INTO billing_credit_notes VALUES (?,?,?,?,?,?,?,?,?,?)").run(id, p.company_id, series, next, receiptNumber(receiptRow),
          "Anulación de la operación (código 01): devolución total", receiptRow.base, receiptRow.igv, receiptRow.total, now);
      }
      db.prepare("UPDATE billing_refunds SET state = 'refunded', remote_id = ?, refunded_at = ? WHERE payment_id = ?").run(remoteRefund, now, id);
      const referrer = revokeReferralReward(db, id, now);
      if (referrer) writeAudit(db, { action: "referral.reward", companyId: referrer, detail: "Se descontaron 31 días: el pago de la empresa invitada fue reembolsado." });
      event(id, "refunded", p.provider === "culqi" ? "Devolución confirmada por Culqi; plan ajustado y nota de crédito emitida." : "Devolución simulada; plan ajustado y nota de crédito emitida.");
      writeAudit(db, { action: "billing.refund", companyId: p.company_id, userId: actor.userId, detail: `${soles(p.amount)} · ${reason}` });
      return { paid: false, payment: summary(row(id)) };
    });
  }

  function overview(actor: BillingActor): BillingOverview {
    const config = billingConfiguration();
    const stored = one<{ first_name: string; last_name: string; email: string; phone: string }>("SELECT * FROM billing_buyers WHERE user_id = ?", actor.userId);
    const [firstName = "", ...rest] = actor.name.trim().split(/\s+/);
    const company = one<{ name: string; tax_id: string | null }>("SELECT name, tax_id FROM companies WHERE id = ?", actor.companyId);
    const ruc = company?.tax_id && isValidRuc(company.tax_id) ? company.tax_id : "";
    return {
      enabled: config.enabled, simulatorEnabled: config.simulatorEnabled, configurationMessage: config.message,
      buyer: stored ? { firstName: stored.first_name, lastName: stored.last_name, email: stored.email, phone: stored.phone }
        : { firstName, lastName: rest.join(" "), email: actor.email, phone: "" },
      payments: many<PaymentRow>("SELECT * FROM billing_payments WHERE company_id = ? ORDER BY created_at DESC, id DESC LIMIT 30", actor.companyId).map(summary),
      memberships: many<{ mode: PaymentMode; planId: BillingPlanId; activeUntil: number }>("SELECT mode,plan_id AS planId,active_until AS activeUntil FROM billing_memberships WHERE company_id = ?", actor.companyId).map((m) => ({ ...m, active: m.activeUntil > Date.now() })),
      invoice: { type: ruc ? "factura" : "boleta", documentNumber: ruc, legalName: company?.name ?? "" },
      plan: limitsOf(db, actor.companyId),
      usage: usageOf(db, actor.companyId),
      renewal: renewalNotice(db, actor.companyId),
    };
  }
  function receipt(actor: BillingActor, id: string): Receipt | null {
    const r = one<ReceiptRow>("SELECT * FROM billing_receipts WHERE payment_id = ? AND company_id = ?", id, actor.companyId);
    if (!r) return null;
    const p = row(id);
    return { number: receiptNumber(r), type: r.type, paymentId: id, customerName: r.customer_name, documentNumber: r.document_number, base: r.base, igv: r.igv, total: r.total,
      planName: findBillingPlan(p.plan_id)!.name, method: p.method ?? "Pago en línea", mode: p.mode, issuedAt: r.issued_at, creditNote: creditNote(id) };
  }
  function creditNote(paymentId: string): CreditNote | null {
    const n = creditNoteRow(paymentId);
    return n ? { number: receiptNumber(n), reference: n.reference, reason: n.reason, base: n.base, igv: n.igv, total: n.total, issuedAt: n.issued_at } : null;
  }
  function rateLimit(key: string, max: number, windowMs: number) {
    const now = Date.now();
    return atomic(() => {
      db.prepare("DELETE FROM billing_rate_limits WHERE resets_at <= ?").run(now);
      const current = one<{ hits: number }>("SELECT hits FROM billing_rate_limits WHERE key = ?", key);
      if (current && current.hits >= max) return false;
      db.prepare("INSERT INTO billing_rate_limits VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET hits=hits+1").run(key, now + windowMs);
      return true;
    });
  }
  return { checkout, resume, charge, status, webhook, simulate, cancelAuthentication, refund, overview, receipt, rateLimit };
}
export type BillingService = ReturnType<typeof createBillingService>;
