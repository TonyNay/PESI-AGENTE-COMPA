import crypto from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

/**
 * Programa de referidos: cada empresa tiene un código. Cuando una empresa invitada paga su primer plan,
 * la empresa que la invitó recibe 31 días adicionales (o un plan Emprendedor si no tenía uno vigente).
 * La recompensa se otorga en la misma transacción que confirma el pago y se revierte si ese pago se reembolsa.
 */
export const REFERRAL_REWARD_DAYS = 31;
/** Tope de recompensas por empresa para limitar el abuso del programa. */
export const REFERRAL_MAX_REWARDS = 12;
const DAY = 86_400_000;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS referral_codes (
  company_id INTEGER PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS referrals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  referrer_company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  referred_company_id INTEGER NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  rewarded_at INTEGER,
  reward_payment_id TEXT,
  reward_mode TEXT
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_company_id);
`;
const prepared = new WeakSet<DatabaseSync>();
export function ensureReferralSchema(db: DatabaseSync) {
  if (prepared.has(db)) return;
  db.exec(SCHEMA);
  prepared.add(db);
}

const one = <T>(db: DatabaseSync, sql: string, ...v: (string | number | null)[]) => {
  const r = db.prepare(sql).get(...v); return r ? ({ ...r } as T) : undefined;
};

/** Normaliza lo que escribe el usuario: "compa-ab12cd", " AB12CD " → "COMPA-AB12CD". */
export function normalizeReferralCode(input: unknown): string | null {
  const raw = String(input ?? "").trim().toUpperCase().replace(/\s+/g, "");
  const body = raw.replace(/^COMPA-?/, "");
  return /^[A-Z2-9]{6}$/.test(body) ? `COMPA-${body}` : null;
}

/** Devuelve el código de la empresa y lo crea la primera vez. */
export function referralCode(db: DatabaseSync, companyId: number): string {
  ensureReferralSchema(db);
  const existing = one<{ code: string }>(db, "SELECT code FROM referral_codes WHERE company_id = ?", companyId);
  if (existing) return existing.code;
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O ni 1/I para evitar confusiones al dictarlo
  for (let i = 0; i < 10; i++) {
    const code = `COMPA-${Array.from(crypto.randomBytes(6), (b) => alphabet[b % alphabet.length]).join("")}`;
    try { db.prepare("INSERT INTO referral_codes (company_id, code) VALUES (?,?)").run(companyId, code); return code; }
    catch { if (one(db, "SELECT 1 FROM referral_codes WHERE company_id = ?", companyId)) return referralCode(db, companyId); }
  }
  throw new Error("No se pudo generar el código de referido.");
}

/** Vincula una empresa recién registrada con quien la invitó. Devuelve false si el código no aplica. */
export function linkReferral(db: DatabaseSync, referredCompanyId: number, rawCode: unknown): boolean {
  ensureReferralSchema(db);
  const code = normalizeReferralCode(rawCode);
  if (!code) return false;
  const owner = one<{ company_id: number }>(db, "SELECT company_id FROM referral_codes WHERE code = ?", code);
  if (!owner || owner.company_id === referredCompanyId) return false;
  // Misma empresa con otra cuenta (mismo RUC): no cuenta como referido.
  const ruc = (id: number) => one<{ tax_id: string | null }>(db, "SELECT tax_id FROM companies WHERE id = ?", id)?.tax_id ?? null;
  const a = ruc(owner.company_id), b = ruc(referredCompanyId);
  if (a && b && a === b) return false;
  const r = db.prepare("INSERT OR IGNORE INTO referrals (referrer_company_id, referred_company_id) VALUES (?,?)").run(owner.company_id, referredCompanyId);
  return Number(r.changes) > 0;
}

/**
 * Se llama dentro de la transacción que confirma un pago. Solo el primer pago confirmado de la empresa
 * invitada otorga la recompensa. Devuelve la empresa beneficiada, o null.
 */
export function rewardReferral(db: DatabaseSync, referredCompanyId: number, mode: string, paymentId: string, now = Date.now()): number | null {
  ensureReferralSchema(db);
  const ref = one<{ id: number; referrer_company_id: number; rewarded_at: number | null }>(db,
    "SELECT id, referrer_company_id, rewarded_at FROM referrals WHERE referred_company_id = ?", referredCompanyId);
  if (!ref || ref.rewarded_at) return null;
  const given = one<{ n: number }>(db, "SELECT COUNT(*) AS n FROM referrals WHERE referrer_company_id = ? AND rewarded_at IS NOT NULL", ref.referrer_company_id)?.n ?? 0;
  if (given >= REFERRAL_MAX_REWARDS) return null;
  const m = one<{ plan_id: string; active_until: number }>(db, "SELECT plan_id, active_until FROM billing_memberships WHERE company_id = ? AND mode = ?", ref.referrer_company_id, mode);
  const active = m && m.active_until > now;
  const until = (active ? m.active_until : now) + REFERRAL_REWARD_DAYS * DAY;
  db.prepare(`INSERT INTO billing_memberships VALUES (?,?,?,?,?) ON CONFLICT(company_id,mode)
    DO UPDATE SET plan_id=excluded.plan_id, active_until=excluded.active_until, updated_at=excluded.updated_at`)
    .run(ref.referrer_company_id, mode, active ? m.plan_id : "emprendedor", until, now);
  db.prepare("UPDATE referrals SET rewarded_at = ?, reward_payment_id = ?, reward_mode = ? WHERE id = ?").run(now, paymentId, mode, ref.id);
  return ref.referrer_company_id;
}

/** Si se reembolsa el pago que originó una recompensa, se descuentan esos días al referente. */
export function revokeReferralReward(db: DatabaseSync, paymentId: string, now = Date.now()): number | null {
  ensureReferralSchema(db);
  const ref = one<{ id: number; referrer_company_id: number; reward_mode: string }>(db,
    "SELECT id, referrer_company_id, reward_mode FROM referrals WHERE reward_payment_id = ?", paymentId);
  if (!ref) return null;
  db.prepare("UPDATE billing_memberships SET active_until = MAX(?, active_until - ?), updated_at = ? WHERE company_id = ? AND mode = ?")
    .run(now, REFERRAL_REWARD_DAYS * DAY, now, ref.referrer_company_id, ref.reward_mode);
  // La invitación sigue vigente: un pago posterior de la misma empresa puede volver a recompensar.
  db.prepare("UPDATE referrals SET rewarded_at = NULL, reward_payment_id = NULL, reward_mode = NULL WHERE id = ?").run(ref.id);
  return ref.referrer_company_id;
}

export interface ReferralSummary { code: string; invited: number; rewarded: number; daysEarned: number; maxRewards: number; rewardDays: number }
export function referralSummary(db: DatabaseSync, companyId: number): ReferralSummary {
  const code = referralCode(db, companyId);
  const row = one<{ invited: number; rewarded: number }>(db,
    "SELECT COUNT(*) AS invited, COUNT(rewarded_at) AS rewarded FROM referrals WHERE referrer_company_id = ?", companyId) ?? { invited: 0, rewarded: 0 };
  return { code, invited: row.invited, rewarded: row.rewarded, daysEarned: row.rewarded * REFERRAL_REWARD_DAYS, maxRewards: REFERRAL_MAX_REWARDS, rewardDays: REFERRAL_REWARD_DAYS };
}
