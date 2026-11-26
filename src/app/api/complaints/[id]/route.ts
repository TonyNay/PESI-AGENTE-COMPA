import { apiSession, json } from "@/lib/api";
import { PaymentError } from "@/lib/billing/config";
import { assertPaymentOrigin } from "@/lib/billing/http";
import { answerComplaint, ComplaintError } from "@/lib/complaints";
import { isPlatformAdmin } from "@/lib/platform";

export const runtime = "nodejs";

/** Solo el personal de Compa responde las hojas: el reclamo es contra Compa como proveedor. */
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertPaymentOrigin(req);
    const r = await apiSession();
    if ("error" in r) return r.error;
    if (!isPlatformAdmin(r.session.user.email)) return json({ error: "Solo el personal de Compa puede responder reclamos." }, 403);
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    return json({ complaint: answerComplaint(Number(id), body.response, r.session.user) });
  } catch (error) {
    if (error instanceof ComplaintError || error instanceof PaymentError) return json({ error: error.message }, error.status);
    return json({ error: "No se pudo guardar la respuesta." }, 500);
  }
}
