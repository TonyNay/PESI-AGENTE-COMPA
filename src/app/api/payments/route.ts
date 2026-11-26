import { paymentRequest } from "@/lib/billing/server";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return paymentRequest(req, {}, (service, actor) => service.overview(actor));
}
export async function POST(req: Request) {
  return paymentRequest(req, { write: true, limit: "checkout" }, async (service, actor, body) => {
    const result = await service.checkout(actor, body);
    audit({ action: "billing.checkout", companyId: actor.companyId, userId: actor.userId, detail: `Plan ${result.payment.planName} · ${result.payment.mode} · ref. ${result.payment.id}`, ip: clientIp(req) });
    return result;
  });
}
