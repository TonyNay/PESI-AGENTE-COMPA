import { clearLoginFails, createSession, loginBlocked, recordLoginFail, setSessionCookie, verifyLogin } from "@/lib/auth";
import { json } from "@/lib/api";
import { secondFactorRequired, verifySecondFactor } from "@/lib/two-factor";
import { audit } from "@/lib/audit";
import { get } from "@/lib/db";
import { clientIp } from "@/lib/platform";

/** Identifica la cuenta del intento para el registro de auditoría (sin guardar la contraseña). */
const accountOf = (email: string) => get<{ id: number; company_id: number }>("SELECT id, company_id FROM users WHERE email = ?", email.trim().toLowerCase());

export const runtime = "nodejs";

export async function POST(req: Request) {
  // X-Real-Ip lo fija el proxy (Traefik en Coolify); el primer valor de X-Forwarded-For lo puede falsificar el cliente.
  const ip = clientIp(req);
  if (loginBlocked(ip)) return json({ error: "Demasiados intentos fallidos. Espera 15 minutos e inténtalo de nuevo." }, 429);
  const b = await req.json().catch(() => ({}));
  const uid = verifyLogin(String(b.email || ""), String(b.password || ""));
  if (!uid) {
    recordLoginFail(ip);
    const known = accountOf(String(b.email || ""));
    if (known) audit({ action: "auth.login_failed", companyId: known.company_id, userId: known.id, detail: "Contraseña incorrecta", ip });
    return json({ error: "Correo o contraseña incorrectos." }, 401);
  }
  if (secondFactorRequired(uid)) {
    // También por cuenta: quien conoce la contraseña podría rotar de IP para probar códigos.
    const account = `2fa:${uid}`;
    if (loginBlocked(account)) return json({ error: "Demasiados intentos fallidos. Espera 15 minutos e inténtalo de nuevo." }, 429);
    const code = String(b.code || "").trim();
    if (!code) return json({ requires2fa: true });
    if (!verifySecondFactor(uid, code)) {
      recordLoginFail(ip);
      recordLoginFail(account);
      audit({ action: "auth.login_failed", companyId: accountOf(String(b.email || ""))?.company_id, userId: uid, detail: "Código de verificación incorrecto", ip });
      return json({ error: "El código no es correcto." }, 401);
    }
    clearLoginFails(account);
  }
  clearLoginFails(ip);
  const s = createSession(uid);
  await setSessionCookie(s.token, s.expires);
  audit({ action: "auth.login", companyId: accountOf(String(b.email || ""))?.company_id, userId: uid, detail: secondFactorRequired(uid) ? "Con verificación en dos pasos" : "Con contraseña", ip });
  return json({ ok: true });
}
