import type { DatabaseSync } from "node:sqlite";
import { FREE_PLAN, findBillingPlan, RENEWAL_NOTICE_DAYS, type BillingPlanId, type PaymentMode, type PlanLimits, type RenewalNotice } from "./catalog";

export type LimitKind = "priceAnalyses" | "strategicAnalyses" | "products";

const LABEL: Record<LimitKind, string> = {
  priceAnalyses: "análisis de precios este mes", strategicAnalyses: "análisis estratégicos este mes", products: "productos en el catálogo",
};

/** Primer instante del mes en curso en la hora de Lima (UTC-5, sin horario de verano). */
function monthStart(now: number) {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "America/Lima", year: "numeric", month: "2-digit" }).formatToParts(now);
  return new Date(`${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}-01T00:00:00-05:00`).toISOString();
}

/** Un análisis en cola o en curso consume cupo; uno fallido no. */
export function usageOf(db: DatabaseSync, companyId: number, now = Date.now()): Record<LimitKind, number> {
  const start = monthStart(now);
  const count = (sql: string, ...params: (string | number)[]) => Number((db.prepare(sql).get(...params) as { n: number }).n);
  return {
    priceAnalyses: count("SELECT COUNT(*) AS n FROM analyses WHERE company_id = ? AND status != 'failed' AND datetime(created_at) >= datetime(?)", companyId, start),
    strategicAnalyses: count("SELECT COUNT(*) AS n FROM strategic_analyses WHERE company_id = ? AND status != 'failed' AND datetime(created_at) >= datetime(?)", companyId, start),
    products: count("SELECT COUNT(*) AS n FROM products WHERE company_id = ?", companyId),
  };
}

/** Si hay varias membresías vigentes (prueba y simulación), rige la de mayor capacidad. */
export function limitsOf(db: DatabaseSync, companyId: number, now = Date.now()): PlanLimits {
  const active = db.prepare("SELECT plan_id FROM billing_memberships WHERE company_id = ? AND active_until > ?").all(companyId, now) as unknown as { plan_id: BillingPlanId }[];
  const best = active.map((m) => findBillingPlan(m.plan_id)!).sort((a, b) => b.amount - a.amount)[0];
  return best ? { name: best.name, priceAnalyses: best.priceAnalyses, strategicAnalyses: best.strategicAnalyses, products: best.products } : FREE_PLAN;
}

/** Devuelve el mensaje para el usuario si la operación supera el plan, o null si procede. */
export function limitError(db: DatabaseSync, companyId: number, kind: LimitKind, adding = 1): string | null {
  if (process.env.COMPA_ENFORCE_PLAN_LIMITS === "0") return null;
  const plan = limitsOf(db, companyId);
  const used = usageOf(db, companyId)[kind];
  if (used + adding <= plan[kind]) return null;
  return `Tu plan ${plan.name} incluye ${plan[kind]} ${LABEL[kind]} y ya usaste ${used}. Puedes ampliarlo en Mi plan.`;
}

const DAY = 86_400_000;
/**
 * Aviso de renovación: el plan vigente vence en RENEWAL_NOTICE_DAYS días o menos, o el último plan venció
 * hace menos de 7 días y no hay otro vigente. Compa no cobra de forma automática: el aviso invita a renovar.
 */
export function renewalNotice(db: DatabaseSync, companyId: number, now = Date.now()): RenewalNotice | null {
  const rows = db.prepare("SELECT mode, plan_id, active_until FROM billing_memberships WHERE company_id = ? ORDER BY active_until DESC")
    .all(companyId) as unknown as { mode: PaymentMode; plan_id: BillingPlanId; active_until: number }[];
  const latest = rows[0];
  if (!latest) return null;
  const plan = findBillingPlan(latest.plan_id);
  if (!plan) return null;
  const left = latest.active_until - now;
  const base = { planId: plan.id, planName: plan.name, mode: latest.mode, activeUntil: latest.active_until, daysLeft: Math.max(0, Math.ceil(left / DAY)) };
  if (left > 0) return left <= RENEWAL_NOTICE_DAYS * DAY ? { ...base, state: "expiring" } : null;
  return -left <= 7 * DAY ? { ...base, state: "expired" } : null;
}
