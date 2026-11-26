import { exportAccount } from "@/lib/account";
import { apiSession } from "@/lib/api";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/platform";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const r = await apiSession();
  if ("error" in r) return r.error;
  audit({ action: "account.export", companyId: r.session.company.id, userId: r.session.user.id, ip: clientIp(req) });
  return new Response(JSON.stringify(exportAccount(r.session.user.id, r.session.company.id), null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": 'attachment; filename="compa-mis-datos.json"', "Cache-Control": "no-store" },
  });
}
