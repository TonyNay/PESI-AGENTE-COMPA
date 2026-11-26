import crypto from "node:crypto";
import { billingService, paymentError, paymentJson } from "@/lib/billing/server";
import { readPaymentBody } from "@/lib/billing/http";
import { PaymentError } from "@/lib/billing/config";

export const runtime = "nodejs";

/** Público para Culqi. La notificación dispara consultas autenticadas; no acredita por su cuerpo. */
export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "unknown";
    const key = crypto.createHash("sha256").update(ip).digest("hex");
    const service = billingService();
    if (!service.rateLimit(`webhook:${key}`, 120, 60_000)) throw new PaymentError("Demasiadas notificaciones.", 429);
    await service.webhook(await readPaymentBody(req));
    return paymentJson({ ok: true });
  } catch (error) { return paymentError(error); }
}
