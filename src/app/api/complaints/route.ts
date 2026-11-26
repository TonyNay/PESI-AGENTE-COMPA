import { json } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { PaymentError } from "@/lib/billing/config";
import { assertPaymentOrigin, readPaymentBody } from "@/lib/billing/http";
import { billingService } from "@/lib/billing/server";
import { ComplaintError, createComplaint, findComplaint } from "@/lib/complaints";
import { clientIp } from "@/lib/platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function failure(error: unknown) {
  if (error instanceof ComplaintError || error instanceof PaymentError) return json({ error: error.message }, error.status);
  console.error("[compa-reclamos] Error interno");
  return json({ error: "No se pudo registrar la hoja. Inténtalo de nuevo." }, 500);
}

/** Registro público: no exige cuenta (cualquier consumidor puede reclamar). */
export async function POST(req: Request) {
  try {
    assertPaymentOrigin(req);
    const ip = clientIp(req);
    if (!billingService().rateLimit(`complaint:${ip}`, 5, 60 * 60_000)) throw new ComplaintError("Registraste varias hojas seguidas. Espera un momento e inténtalo de nuevo.", 429);
    const body = await readPaymentBody(req);
    const session = await getSession();
    const complaint = createComplaint(body, { companyId: session?.company.id, userId: session?.user.id, ip });
    return json({ complaint }, 201);
  } catch (error) { return failure(error); }
}

/** Consulta de una hoja por su número y el documento del consumidor. */
export async function GET(req: Request) {
  try {
    const ip = clientIp(req);
    if (!billingService().rateLimit(`complaint-lookup:${ip}`, 20, 15 * 60_000)) throw new ComplaintError("Demasiadas consultas. Espera un momento.", 429);
    const url = new URL(req.url);
    const found = findComplaint(url.searchParams.get("code") ?? "", url.searchParams.get("document") ?? "");
    if (!found) return json({ error: "No encontramos una hoja con ese número y documento." }, 404);
    return json({ complaint: found });
  } catch (error) { return failure(error); }
}
