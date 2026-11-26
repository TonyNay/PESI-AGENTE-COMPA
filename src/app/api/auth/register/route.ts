import { createCompanyAndUser, createSession, registrationOpen, setSessionCookie } from "@/lib/auth";
import { json } from "@/lib/api";
import { recordConsent } from "@/lib/account";
import { LEGAL_VERSION } from "@/lib/legal";
import { audit } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { clientIp } from "@/lib/platform";
import { linkReferral } from "@/lib/referrals";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!registrationOpen()) return json({ error: "El registro está cerrado. Pide una cuenta al administrador." }, 403);
  const b = await req.json().catch(() => ({}));
  if (!b.companyName || !b.name || !b.email || !b.password) return json({ error: "Completa empresa, nombre, correo y contraseña." }, 400);
  if (b.acceptedLegal !== LEGAL_VERSION) return json({ error: "Debes aceptar la política de privacidad y los términos." }, 400);
  if (String(b.password).length < 8) return json({ error: "La contraseña debe tener al menos 8 caracteres." }, 400);
  if (!/^\S+@\S+\.\S+$/.test(String(b.email))) return json({ error: "Correo inválido." }, 400);
  try {
    const { userId, companyId } = createCompanyAndUser(b);
    recordConsent(userId);
    const referred = b.referralCode ? linkReferral(getDb(), companyId, b.referralCode) : false;
    audit({ action: "auth.register", companyId, userId, detail: referred ? "Registro con código de referido" : null, ip: clientIp(req) });
    const s = createSession(userId);
    await setSessionCookie(s.token, s.expires);
    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
}
