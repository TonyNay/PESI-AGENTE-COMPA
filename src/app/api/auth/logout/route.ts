import { destroySession, getSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/platform";
import { json } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getSession();
  await destroySession();
  if (session) audit({ action: "auth.logout", companyId: session.company.id, userId: session.user.id, ip: clientIp(req) });
  return json({ ok: true });
}
