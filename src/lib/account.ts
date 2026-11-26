import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import fs from "node:fs";
import { all, get, getDb, run } from "./db";
import { ensureBillingSchema } from "./billing/service";
import { LEGAL_VERSION } from "./legal";
import { ensureAuditSchema } from "./audit";

/** La cuenta compartida para exponer el proyecto no se puede borrar desde la interfaz. */
export const DEMO_EMAIL = "demo@compa.pe";

export class AccountError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

export function recordConsent(userId: number) {
  run("INSERT OR IGNORE INTO legal_consents (user_id, version) VALUES (?,?)", userId, LEGAL_VERSION);
}

export function currentConsent(userId: number) {
  return get<{ version: string; accepted_at: string }>("SELECT version, accepted_at FROM legal_consents WHERE user_id = ? AND version = ?", userId, LEGAL_VERSION) ?? null;
}

export function updateAccount(user: { id: number; role: string; company_id: number }, input: { name?: unknown; companyName?: unknown; taxId?: unknown; industry?: unknown }) {
  const name = String(input.name ?? "").trim();
  if (name.length < 2 || name.length > 80) throw new AccountError("Escribe un nombre de 2 a 80 caracteres.");
  run("UPDATE users SET name = ? WHERE id = ?", name, user.id);
  if (user.role !== "admin") return;
  const companyName = String(input.companyName ?? "").trim();
  if (companyName.length < 2 || companyName.length > 120) throw new AccountError("Escribe el nombre de la empresa.");
  const taxId = String(input.taxId ?? "").trim();
  if (taxId && !/^\d{11}$/.test(taxId)) throw new AccountError("El RUC debe tener 11 dígitos.");
  run("UPDATE companies SET name = ?, tax_id = ?, industry = ? WHERE id = ?", companyName, taxId || null, String(input.industry ?? "").trim().slice(0, 80) || null, user.company_id);
}

/** Copia legible de los datos del usuario y su empresa. Nunca incluye el hash de la contraseña ni las sesiones. */
export function exportAccount(userId: number, companyId: number) {
  ensureBillingSchema(getDb());
  ensureAuditSchema(getDb());
  const parseBuyer = (p: { buyer: string; invoice: string | null }) => ({ ...p, buyer: JSON.parse(p.buyer), invoice: p.invoice ? JSON.parse(p.invoice) : null });
  return {
    generadoEl: new Date().toISOString(),
    usuario: get("SELECT id, email, name, role, created_at FROM users WHERE id = ?", userId),
    empresa: get("SELECT id, name, tax_id, industry, country, currency, created_at FROM companies WHERE id = ?", companyId),
    consentimientos: all("SELECT version, accepted_at FROM legal_consents WHERE user_id = ?", userId),
    productos: all("SELECT * FROM products WHERE company_id = ?", companyId),
    analisisDePrecios: all("SELECT id, product_id, status, provider, created_at, finished_at, reviewed_by, reviewed_at, result_json FROM analyses WHERE company_id = ?", companyId),
    ofertasDeCompetidores: all("SELECT o.* FROM competitor_offers o JOIN analyses a ON a.id = o.analysis_id WHERE a.company_id = ?", companyId),
    analisisEstrategicos: all("SELECT id, subject_kind, subject_name, website_url, industry, country, notes, doc_name, status, provider, created_at, finished_at, reviewed_by, reviewed_at, result_json FROM strategic_analyses WHERE company_id = ?", companyId),
    pagos: all<{ buyer: string; invoice: string | null }>("SELECT id, plan_id, amount, provider, mode, status, method, buyer, invoice, terms_version, created_at, paid_at FROM billing_payments WHERE company_id = ?", companyId).map(parseBuyer),
    comprobantes: all("SELECT * FROM billing_receipts WHERE company_id = ?", companyId),
    notasDeCredito: all("SELECT * FROM billing_credit_notes WHERE company_id = ?", companyId),
    actividad: all("SELECT action, detail, ip, created_at FROM audit_log WHERE user_id = ? ORDER BY id", userId),
  };
}

/**
 * Atiende la cancelación. El usuario se anonimiza en vez de borrarse porque los pagos lo referencian
 * y los comprobantes se conservan por obligación tributaria. Si era el único de la empresa, también
 * se elimina el contenido de la empresa.
 */
export function deleteAccount(user: { id: number; email: string; company_id: number }, password: string) {
  if (user.email === DEMO_EMAIL) throw new AccountError("La cuenta de demostración está protegida y no se puede eliminar.", 403);
  const stored = get<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = ?", user.id);
  if (!stored || !bcrypt.compareSync(password, stored.password_hash)) throw new AccountError("La contraseña no es correcta.", 403);
  const db = getDb();
  ensureBillingSchema(db);
  const companyId = user.company_id;
  const lastUser = !get("SELECT 1 FROM users WHERE company_id = ? AND id != ?", companyId, user.id);
  if (lastUser && (get("SELECT 1 FROM analyses WHERE company_id = ? AND status IN ('queued','running')", companyId) || get("SELECT 1 FROM strategic_analyses WHERE company_id = ? AND status IN ('queued','running')", companyId)))
    throw new AccountError("Espera a que terminen los análisis en curso.", 409);
  const documents = lastUser ? all<{ doc_path: string }>("SELECT doc_path FROM strategic_analyses WHERE company_id = ? AND doc_path IS NOT NULL", companyId) : [];
  db.exec("BEGIN IMMEDIATE");
  try {
    if (lastUser) {
      run("DELETE FROM strategic_analyses WHERE company_id = ?", companyId);
      run("DELETE FROM analyses WHERE company_id = ?", companyId);
      run("DELETE FROM products WHERE company_id = ?", companyId);
      run("DELETE FROM billing_memberships WHERE company_id = ?", companyId);
      run("UPDATE companies SET name = 'Empresa eliminada', tax_id = NULL, industry = NULL WHERE id = ?", companyId);
    }
    run("DELETE FROM sessions WHERE user_id = ?", user.id);
    run("DELETE FROM billing_buyers WHERE user_id = ?", user.id);
    run("UPDATE billing_payments SET status = 'cancelled', message = 'Cancelada al eliminar la cuenta.' WHERE user_id = ? AND status IN ('creating','pending')", user.id);
    run("UPDATE billing_payments SET buyer = ? WHERE user_id = ?", JSON.stringify({ firstName: "Eliminado", lastName: "Eliminado", email: "eliminado@compa.invalid", phone: "000000000" }), user.id);
    run("DELETE FROM user_recovery_codes WHERE user_id = ?", user.id);
    run("UPDATE users SET email = ?, name = 'Cuenta eliminada', password_hash = ?, totp_secret = NULL, totp_enabled_at = NULL, totp_last_step = NULL WHERE id = ?", `eliminado-${user.id}@compa.invalid`, crypto.randomBytes(32).toString("hex"), user.id);
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }
  for (const d of documents) fs.rmSync(d.doc_path, { force: true });
  return { companyErased: lastUser };
}
