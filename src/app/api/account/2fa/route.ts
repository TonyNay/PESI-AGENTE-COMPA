import { cookies } from "next/headers";
import QRCode from "qrcode";
import { AccountError } from "@/lib/account";
import { apiSession, json } from "@/lib/api";
import { SESSION_COOKIE } from "@/lib/auth";
import { PaymentError } from "@/lib/billing/config";
import { assertPaymentOrigin } from "@/lib/billing/http";
import { billingService } from "@/lib/billing/server";
import { run } from "@/lib/db";
import { confirmEnrollment, disableTwoFactor, startEnrollment } from "@/lib/two-factor";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/platform";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    assertPaymentOrigin(req);
    const r = await apiSession();
    if ("error" in r) return r.error;
    const { user } = r.session;
    if (!billingService().rateLimit(`account-2fa:${user.id}`, 10, 15 * 60_000)) throw new AccountError("Demasiados intentos. Espera un momento.", 429);
    const b = await req.json().catch(() => ({}));
    const password = String(b.password ?? "");
    const code = String(b.code ?? "");
    if (b.action === "start") {
      const { secret, uri } = startEnrollment(user, password);
      return json({ secret, qr: await QRCode.toDataURL(uri, { margin: 1, width: 220 }) });
    }
    if (b.action === "confirm") {
      const recoveryCodes = confirmEnrollment(user.id, code);
      // Una sesión abierta antes de activar el segundo factor no debe seguir vigente en otro equipo.
      run("DELETE FROM sessions WHERE user_id = ? AND token != ?", user.id, (await cookies()).get(SESSION_COOKIE)?.value ?? "");
      audit({ action: "2fa.enable", companyId: r.session.company.id, userId: user.id, ip: clientIp(req) });
      return json({ recoveryCodes });
    }
    if (b.action === "disable") {
      disableTwoFactor(user.id, password, code);
      audit({ action: "2fa.disable", companyId: r.session.company.id, userId: user.id, ip: clientIp(req) });
      return json({ ok: true });
    }
    return json({ error: "Acción no válida." }, 400);
  } catch (error) {
    if (error instanceof AccountError || error instanceof PaymentError) return json({ error: error.message }, error.status);
    console.error("[compa-cuenta] Error interno en verificación en dos pasos");
    return json({ error: "No se pudo completar la solicitud." }, 500);
  }
}
