import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { AccountError } from "./account";
import { all, get, getDb, run } from "./db";
import { base32Encode, matchTotp, openSecret, sealSecret, totpEncryptionReady } from "./totp";

type Row = { totp_secret: string | null; totp_enabled_at: string | null; totp_last_step: number | null };
type Actor = { id: number; email: string };

const RECOVERY_CODES = 8;
const hashCode = (code: string) => crypto.createHash("sha256").update(code).digest("hex");
const normalizeRecovery = (code: string) => code.toLowerCase().replace(/[^0-9a-f]/g, "");
const state = (userId: number) => get<Row>("SELECT totp_secret, totp_enabled_at, totp_last_step FROM users WHERE id = ?", userId);

function requirePassword(userId: number, password: string) {
  const row = get<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = ?", userId);
  if (!row || !bcrypt.compareSync(password, row.password_hash)) throw new AccountError("La contraseña no es correcta.", 403);
}

export function secondFactorRequired(userId: number) {
  return Boolean(state(userId)?.totp_enabled_at);
}

export function twoFactorStatus(userId: number) {
  const enabled = secondFactorRequired(userId);
  const left = all("SELECT 1 FROM user_recovery_codes WHERE user_id = ? AND used_at IS NULL", userId).length;
  return { enabled, recoveryLeft: enabled ? left : 0 };
}

/** El intervalo solo se consume si no lo ganó otra solicitud simultánea. */
function consumeStep(userId: number, step: number) {
  return run("UPDATE users SET totp_last_step = ? WHERE id = ? AND (totp_last_step IS NULL OR totp_last_step < ?)", step, userId, step).changes === 1;
}

/** Acepta un código de la aplicación o, una sola vez, un código de recuperación. */
export function verifySecondFactor(userId: number, input: string, now = Date.now()): boolean {
  const row = state(userId);
  if (!row?.totp_secret || !row.totp_enabled_at) return false;
  const code = input.replace(/\s/g, "");
  if (/^\d{6}$/.test(code)) {
    const secret = openSecret(row.totp_secret, userId);
    if (!secret) { console.error("[compa-cuenta] No se pudo descifrar el secreto de 2FA; revisa COMPA_TOTP_KEY."); return false; }
    const step = matchTotp(secret, code, row.totp_last_step, now);
    return step !== null && consumeStep(userId, step);
  }
  return run("UPDATE user_recovery_codes SET used_at = datetime('now') WHERE user_id = ? AND code_hash = ? AND used_at IS NULL", userId, hashCode(normalizeRecovery(code))).changes === 1;
}

export function startEnrollment(user: Actor, password: string) {
  if (!totpEncryptionReady()) throw new AccountError("La verificación en dos pasos no está configurada en este servidor.", 503);
  requirePassword(user.id, password);
  if (secondFactorRequired(user.id)) throw new AccountError("La verificación en dos pasos ya está activa.", 409);
  const secret = base32Encode(crypto.randomBytes(20));
  run("UPDATE users SET totp_secret = ?, totp_last_step = NULL WHERE id = ?", sealSecret(secret, user.id), user.id);
  const label = encodeURIComponent(`Compa:${user.email}`);
  return { secret, uri: `otpauth://totp/${label}?secret=${secret}&issuer=Compa&algorithm=SHA1&digits=6&period=30` };
}

/** Activa el segundo factor y devuelve los códigos de recuperación, que solo se muestran esta vez. */
export function confirmEnrollment(userId: number, code: string, now = Date.now()): string[] {
  const row = state(userId);
  if (!row?.totp_secret) throw new AccountError("Inicia primero la activación.", 409);
  if (row.totp_enabled_at) throw new AccountError("La verificación en dos pasos ya está activa.", 409);
  const secret = openSecret(row.totp_secret, userId);
  if (!secret) throw new AccountError("Inicia de nuevo la activación.", 409);
  const step = matchTotp(secret, code.replace(/\s/g, ""), row.totp_last_step, now);
  if (step === null) throw new AccountError("El código no es correcto. Revisa la hora de tu teléfono e inténtalo de nuevo.");
  const codes = Array.from({ length: RECOVERY_CODES }, () => crypto.randomBytes(8).toString("hex"));
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    run("UPDATE users SET totp_enabled_at = datetime('now'), totp_last_step = ? WHERE id = ?", step, userId);
    run("DELETE FROM user_recovery_codes WHERE user_id = ?", userId);
    for (const value of codes) run("INSERT INTO user_recovery_codes (user_id, code_hash) VALUES (?,?)", userId, hashCode(value));
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }
  return codes.map((value) => value.match(/.{4}/g)!.join("-"));
}

export function disableTwoFactor(userId: number, password: string, code: string, now = Date.now()) {
  requirePassword(userId, password);
  if (!verifySecondFactor(userId, code, now)) throw new AccountError("El código no es correcto.", 403);
  run("UPDATE users SET totp_secret = NULL, totp_enabled_at = NULL, totp_last_step = NULL WHERE id = ?", userId);
  run("DELETE FROM user_recovery_codes WHERE user_id = ?", userId);
}
