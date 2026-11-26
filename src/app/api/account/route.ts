import { AccountError, deleteAccount, updateAccount } from "@/lib/account";
import { apiSession, json } from "@/lib/api";
import { destroySession } from "@/lib/auth";
import { assertPaymentOrigin } from "@/lib/billing/http";
import { PaymentError } from "@/lib/billing/config";
import { billingService } from "@/lib/billing/server";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/platform";

export const runtime = "nodejs";

function failure(error: unknown) {
  if (error instanceof AccountError || error instanceof PaymentError) return json({ error: error.message }, error.status);
  console.error("[compa-cuenta] Error interno");
  return json({ error: "No se pudo completar la solicitud." }, 500);
}

export async function PATCH(req: Request) {
  try {
    assertPaymentOrigin(req);
    const r = await apiSession();
    if ("error" in r) return r.error;
    updateAccount(r.session.user, await req.json().catch(() => ({})));
    audit({ action: "account.update", companyId: r.session.company.id, userId: r.session.user.id, ip: clientIp(req) });
    return json({ ok: true });
  } catch (error) { return failure(error); }
}

export async function DELETE(req: Request) {
  try {
    assertPaymentOrigin(req);
    const r = await apiSession();
    if ("error" in r) return r.error;
    if (!billingService().rateLimit(`account-delete:${r.session.user.id}`, 5, 15 * 60_000)) throw new AccountError("Demasiados intentos. Espera un momento.", 429);
    const body = await req.json().catch(() => ({}));
    const result = deleteAccount(r.session.user, String(body.password ?? ""));
    audit({ action: "account.delete", companyId: r.session.company.id, userId: r.session.user.id, detail: result.companyErased ? "Se eliminó también el contenido de la empresa" : null, ip: clientIp(req) });
    await destroySession();
    return json({ ok: true, ...result });
  } catch (error) { return failure(error); }
}
