import type { DatabaseSync } from "node:sqlite";
import { getDb } from "./db";

/**
 * Registro de auditoría general (ISO/IEC 27001:2022, control 8.15 "Registro de eventos").
 * Guarda quién hizo qué y cuándo en las acciones sensibles. Nunca guarda contraseñas, códigos,
 * tokens ni datos de tarjeta. Se conserva un año.
 */
export type AuditAction =
  | "auth.login" | "auth.login_failed" | "auth.logout" | "auth.register"
  | "account.update" | "account.export" | "account.delete" | "account.consent"
  | "2fa.enable" | "2fa.disable"
  | "billing.checkout" | "billing.paid" | "billing.refund" | "referral.reward"
  | "catalog.import" | "complaint.created" | "complaint.answered";

export const AUDIT_LABEL: Record<AuditAction, string> = {
  "auth.login": "Inicio de sesión",
  "auth.login_failed": "Intento de inicio de sesión fallido",
  "auth.logout": "Cierre de sesión",
  "auth.register": "Registro de la empresa",
  "account.update": "Actualización de datos de la cuenta",
  "account.export": "Descarga de una copia de los datos",
  "account.delete": "Eliminación de la cuenta",
  "account.consent": "Aceptación de la política de privacidad",
  "2fa.enable": "Activación de la verificación en dos pasos",
  "2fa.disable": "Desactivación de la verificación en dos pasos",
  "billing.checkout": "Inicio de una compra",
  "billing.paid": "Pago confirmado y plan activado",
  "billing.refund": "Reembolso y nota de crédito",
  "referral.reward": "Recompensa por referido",
  "catalog.import": "Importación del catálogo",
  "complaint.created": "Registro en el Libro de Reclamaciones",
  "complaint.answered": "Respuesta a una hoja de reclamación",
};

export interface AuditEntry {
  action: AuditAction;
  companyId?: number | null;
  userId?: number | null;
  detail?: string | null;
  ip?: string | null;
}
export interface AuditRow {
  id: number; company_id: number | null; user_id: number | null; user_name: string | null;
  action: AuditAction; detail: string | null; ip: string | null; created_at: string;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER,
  user_id INTEGER,
  action TEXT NOT NULL,
  detail TEXT,
  ip TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_company ON audit_log(company_id, id);
`;
const RETENTION_DAYS = 365;
const prepared = new WeakSet<DatabaseSync>();

export function ensureAuditSchema(db: DatabaseSync) {
  if (prepared.has(db)) return;
  db.exec(SCHEMA);
  db.prepare("DELETE FROM audit_log WHERE created_at < strftime('%Y-%m-%dT%H:%M:%fZ','now', ?)").run(`-${RETENTION_DAYS} days`);
  prepared.add(db);
}

/** Escribe en la base indicada (útil dentro de una transacción de otro módulo). */
export function writeAudit(db: DatabaseSync, e: AuditEntry) {
  ensureAuditSchema(db);
  db.prepare("INSERT INTO audit_log (company_id, user_id, action, detail, ip) VALUES (?,?,?,?,?)")
    .run(e.companyId ?? null, e.userId ?? null, e.action, e.detail?.slice(0, 300) ?? null, e.ip?.slice(0, 64) ?? null);
}

/** Un fallo del registro nunca debe impedir la operación principal. */
export function audit(e: AuditEntry) {
  try { writeAudit(getDb(), e); } catch { console.error("[compa-auditoria] No se pudo registrar el evento", e.action); }
}

/** Eventos de la empresa; con `userId`, solo los de ese usuario (para quien no es administrador). */
export function listAudit(companyId: number, opts: { limit?: number; userId?: number } = {}, db: DatabaseSync = getDb()): AuditRow[] {
  ensureAuditSchema(db);
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  return db.prepare(
    `SELECT a.id, a.company_id, a.user_id, u.name AS user_name, a.action, a.detail, a.ip, a.created_at
     FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
     WHERE a.company_id = ? AND (? IS NULL OR a.user_id = ?) ORDER BY a.id DESC LIMIT ?`
  ).all(companyId, opts.userId ?? null, opts.userId ?? null, limit).map((r) => ({ ...r })) as unknown as AuditRow[];
}
