import { apiSession } from "../api";
import { getDb } from "../db";
import { PaymentError } from "./config";
import { createBillingService, type BillingActor, type BillingService } from "./service";
import { assertPaymentOrigin, readPaymentBody } from "./http";
import { limitError, type LimitKind } from "./limits";

const services = new WeakMap<ReturnType<typeof getDb>, BillingService>();
export function billingService() {
  const db = getDb();
  let service = services.get(db);
  if (!service) { service = createBillingService(db); services.set(db, service); }
  return service;
}
/** Mensaje si la operación excede el plan de la empresa; null si puede continuar. */
export function planLimitError(companyId: number, kind: LimitKind, adding = 1) {
  billingService();
  return limitError(getDb(), companyId, kind, adding);
}
export const paymentJson = (value: unknown, status = 200) => Response.json(value, { status, headers: { "cache-control": "no-store" } });
export function paymentError(error: unknown) {
  if (error instanceof PaymentError) return paymentJson({ error: error.message, uncertain: error.uncertain }, error.status);
  console.error("[compa-pagos] Error interno al procesar la solicitud de pago.");
  return paymentJson({ error: "No se pudo procesar la solicitud de pago." }, 500);
}
export async function paymentRequest(
  req: Request,
  options: { write?: boolean; limit?: "checkout" | "charge" | "status" },
  action: (service: BillingService, actor: BillingActor, body: unknown) => unknown | Promise<unknown>,
) {
  try {
    if (options.write) assertPaymentOrigin(req);
    const auth = await apiSession();
    if ("error" in auth) return paymentJson({ error: "Inicia sesión para ver los pagos de tu empresa." }, 401);
    const { user, company } = auth.session;
    const actor: BillingActor = { userId: user.id, companyId: company.id, name: user.name, email: user.email, role: user.role };
    const service = billingService();
    const limit = options.limit ?? "status";
    const max = limit === "status" ? 90 : limit === "checkout" ? 15 : 30;
    const windowMs = limit === "status" ? 60_000 : 15 * 60_000;
    if (!service.rateLimit(`${limit}:${user.id}`, max, windowMs)) throw new PaymentError("Demasiados intentos. Espera un momento y vuelve a intentar.", 429);
    const body = options.write ? await readPaymentBody(req) : undefined;
    return paymentJson(await action(service, actor, body));
  } catch (error) { return paymentError(error); }
}
