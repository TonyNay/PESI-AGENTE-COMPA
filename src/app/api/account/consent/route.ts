import { recordConsent } from "@/lib/account";
import { apiSession, json } from "@/lib/api";
import { assertPaymentOrigin } from "@/lib/billing/http";
import { PaymentError } from "@/lib/billing/config";
import { audit } from "@/lib/audit";
import { LEGAL_VERSION } from "@/lib/legal";
import { clientIp } from "@/lib/platform";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    assertPaymentOrigin(req);
  } catch (error) {
    return json({ error: (error as PaymentError).message }, 403);
  }
  const r = await apiSession();
  if ("error" in r) return r.error;
  recordConsent(r.session.user.id);
  audit({ action: "account.consent", companyId: r.session.company.id, userId: r.session.user.id, detail: `Versión ${LEGAL_VERSION}`, ip: clientIp(req) });
  return json({ ok: true });
}
