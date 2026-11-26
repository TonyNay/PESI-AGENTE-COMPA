import type { DatabaseSync } from "node:sqlite";
import { RATES_TO_PEN } from "./agent/currency";
import { BILLING_PLANS, findBillingPlan, igvBreakdown, type BillingPlanId } from "./billing/catalog";
import { ensureBillingSchema } from "./billing/service";
import { complaintStats, type ComplaintStats } from "./complaints";
import { ensureReferralSchema } from "./referrals";

/**
 * Métricas del negocio SaaS para el personal de Compa: ingresos recurrentes, conversión de la prueba,
 * cancelación, costo de IA y margen por cliente. Sustituyen las estimaciones del plan de negocio por
 * datos medidos en la propia plataforma.
 */
export const GATEWAY_FEE_RATE = 0.042; // comisión estimada de la pasarela sobre el precio con IGV
export const USD_TO_PEN = RATES_TO_PEN.USD; // mismo tipo de cambio referencial que usa el agente
export type MetricsMode = "all" | "TEST" | "SIMULATED";
const DAY = 86_400_000;

export interface CompanyMetric { companyId: number; name: string; plan: string | null; revenue: number; aiCostPen: number; margin: number; analyses: number }
export interface PlatformMetrics {
  mode: MetricsMode; windowDays: number; generatedAt: number;
  companies: { total: number; trial: number; active: number; expired: number };
  /** Ingreso recurrente mensual: planes vigentes, en céntimos (con IGV y valor de venta). */
  mrr: { gross: number; base: number };
  arpa: number;
  revenue: { gross: number; refunds: number; net: number; base: number; payments: number; refundCount: number };
  conversion: { paying: number; total: number; rate: number | null };
  churn: { churned: number; base: number; rate: number | null };
  ai: { usd: number; pen: number; priceAnalyses: number; strategic: number; perAnalysisUsd: number | null };
  /** Margen de contribución del periodo: valor de venta - comisión - costo de IA (céntimos). */
  margin: { amount: number; fee: number; aiCostPen: number };
  byPlan: { planId: BillingPlanId; name: string; active: number; mrr: number }[];
  daily: { day: string; gross: number }[];
  topCompanies: CompanyMetric[];
  complaints: ComplaintStats;
  referrals: { invited: number; rewarded: number };
}

export function platformMetrics(db: DatabaseSync, opts: { mode?: MetricsMode; windowDays?: number; now?: number } = {}): PlatformMetrics {
  ensureBillingSchema(db);
  ensureReferralSchema(db);
  const mode = opts.mode ?? "all";
  const windowDays = opts.windowDays ?? 30;
  const now = opts.now ?? Date.now();
  const from = now - windowDays * DAY;
  const modeSql = mode === "all" ? "1=1" : "mode = ?";
  const modeArgs = mode === "all" ? [] : [mode];
  const q = <T>(sql: string, ...args: (string | number | null)[]) => db.prepare(sql).all(...args).map((r) => ({ ...r })) as T[];
  const n = (sql: string, ...args: (string | number | null)[]) => Number((db.prepare(sql).get(...args) as { n: number | null }).n ?? 0);

  // Empresas reales: se excluyen las cuentas eliminadas.
  const companies = q<{ id: number; name: string }>("SELECT id, name FROM companies WHERE name != 'Empresa eliminada'");
  const ids = new Set(companies.map((c) => c.id));
  const memberships = q<{ company_id: number; plan_id: BillingPlanId; active_until: number }>(`SELECT company_id, plan_id, active_until FROM billing_memberships WHERE ${modeSql}`, ...modeArgs)
    .filter((m) => ids.has(m.company_id));
  const bestActive = new Map<number, BillingPlanId>();
  const lastEnd = new Map<number, number>();
  for (const m of memberships) {
    lastEnd.set(m.company_id, Math.max(lastEnd.get(m.company_id) ?? 0, m.active_until));
    if (m.active_until > now) {
      const current = bestActive.get(m.company_id);
      if (!current || findBillingPlan(m.plan_id)!.amount > findBillingPlan(current)!.amount) bestActive.set(m.company_id, m.plan_id);
    }
  }
  const everPaid = new Set(q<{ company_id: number }>(`SELECT DISTINCT company_id FROM billing_payments WHERE status IN ('paid','refunded') AND ${modeSql}`, ...modeArgs).map((r) => r.company_id).filter((id) => ids.has(id)));
  const churned = [...lastEnd].filter(([id, end]) => !bestActive.has(id) && end <= now && end > from).length;
  const expired = [...lastEnd].filter(([id, end]) => !bestActive.has(id) && end <= now).length;

  const byPlan = BILLING_PLANS.map((p) => {
    const active = [...bestActive.values()].filter((id) => id === p.id).length;
    return { planId: p.id, name: p.name, active, mrr: active * p.amount };
  });
  const mrrGross = byPlan.reduce((t, p) => t + p.mrr, 0);
  const mrrBase = byPlan.reduce((t, p) => t + p.active * igvBreakdown(BILLING_PLANS.find((x) => x.id === p.planId)!.amount).base, 0);

  const paid = q<{ company_id: number; amount: number; paid_at: number; status: string }>(
    `SELECT company_id, amount, paid_at, status FROM billing_payments WHERE status IN ('paid','refunded') AND paid_at >= ? AND ${modeSql}`, from, ...modeArgs);
  const refunds = q<{ company_id: number; amount: number }>(
    `SELECT r.amount, p.company_id FROM billing_refunds r JOIN billing_payments p ON p.id = r.payment_id
     WHERE r.state = 'refunded' AND r.refunded_at >= ? AND ${mode === "all" ? "1=1" : "p.mode = ?"}`, from, ...modeArgs);
  const gross = paid.reduce((t, p) => t + p.amount, 0);
  const refunded = refunds.reduce((t, r) => t + r.amount, 0);
  const net = gross - refunded;

  // Costo de IA medido por el agente (US$), por empresa y en total.
  const aiRows = q<{ company_id: number; kind: string; cost: number | null }>(
    `SELECT company_id, 'price' AS kind, json_extract(result_json, '$.meta.costUsd') AS cost FROM analyses WHERE status = 'completed' AND datetime(finished_at) >= datetime(?)
     UNION ALL
     SELECT company_id, 'strategic' AS kind, json_extract(result_json, '$.meta.costUsd') AS cost FROM strategic_analyses WHERE status = 'completed' AND datetime(finished_at) >= datetime(?)`,
    new Date(from).toISOString(), new Date(from).toISOString());
  const aiUsd = aiRows.reduce((t, r) => t + (Number(r.cost) || 0), 0);
  const withCost = aiRows.filter((r) => Number(r.cost) > 0).length;
  const aiPen = Math.round(aiUsd * USD_TO_PEN * 100);
  const fee = Math.round(gross * GATEWAY_FEE_RATE);
  const netBase = igvBreakdown(net).base;

  const perCompany = new Map<number, CompanyMetric>();
  const entry = (id: number) => {
    let e = perCompany.get(id);
    if (!e) { e = { companyId: id, name: companies.find((c) => c.id === id)?.name ?? `Empresa ${id}`, plan: bestActive.has(id) ? findBillingPlan(bestActive.get(id)!)!.name : null, revenue: 0, aiCostPen: 0, margin: 0, analyses: 0 }; perCompany.set(id, e); }
    return e;
  };
  for (const p of paid) if (ids.has(p.company_id)) entry(p.company_id).revenue += p.amount;
  for (const r of refunds) if (ids.has(r.company_id)) entry(r.company_id).revenue -= r.amount;
  for (const r of aiRows) if (ids.has(r.company_id)) { const e = entry(r.company_id); e.aiCostPen += Math.round((Number(r.cost) || 0) * USD_TO_PEN * 100); e.analyses++; }
  for (const e of perCompany.values()) e.margin = igvBreakdown(Math.max(0, e.revenue)).base - Math.round(Math.max(0, e.revenue) * GATEWAY_FEE_RATE) - e.aiCostPen;

  const daily: { day: string; gross: number }[] = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const start = now - (i + 1) * DAY, end = now - i * DAY;
    daily.push({ day: new Date(end - 5 * 3_600_000).toISOString().slice(5, 10), gross: paid.filter((p) => p.paid_at > start && p.paid_at <= end).reduce((t, p) => t + p.amount, 0) });
  }

  const referralRow = db.prepare("SELECT COUNT(*) AS invited, COUNT(rewarded_at) AS rewarded FROM referrals").get() as { invited: number; rewarded: number };
  const active = bestActive.size;
  const churnBase = active + churned;
  return {
    mode, windowDays, generatedAt: now,
    companies: { total: companies.length, trial: companies.filter((c) => !everPaid.has(c.id)).length, active, expired },
    mrr: { gross: mrrGross, base: mrrBase },
    arpa: active ? Math.round(mrrGross / active) : 0,
    revenue: { gross, refunds: refunded, net, base: netBase, payments: paid.length, refundCount: refunds.length },
    conversion: { paying: everPaid.size, total: companies.length, rate: companies.length ? everPaid.size / companies.length : null },
    churn: { churned, base: churnBase, rate: churnBase ? churned / churnBase : null },
    ai: { usd: aiUsd, pen: aiPen, priceAnalyses: aiRows.filter((r) => r.kind === "price").length, strategic: aiRows.filter((r) => r.kind === "strategic").length, perAnalysisUsd: withCost ? aiUsd / withCost : null },
    margin: { amount: netBase - fee - aiPen, fee, aiCostPen: aiPen },
    byPlan,
    daily,
    topCompanies: [...perCompany.values()].sort((a, b) => b.revenue - a.revenue || b.aiCostPen - a.aiCostPen).slice(0, 10),
    complaints: complaintStats(db, now),
    referrals: { invited: Number(referralRow.invited), rewarded: Number(referralRow.rewarded) },
  };
}

/** Datos para descargar en CSV. */
export function metricsCsvRows(m: PlatformMetrics): (string | number)[][] {
  const s = (c: number) => (c / 100).toFixed(2);
  return [
    ["indicador", "valor"],
    ["empresas_registradas", m.companies.total], ["empresas_en_prueba", m.companies.trial], ["empresas_con_plan_vigente", m.companies.active],
    ["mrr_con_igv_soles", s(m.mrr.gross)], ["mrr_valor_venta_soles", s(m.mrr.base)], ["arpa_soles", s(m.arpa)],
    [`ingresos_${m.windowDays}d_soles`, s(m.revenue.gross)], [`reembolsos_${m.windowDays}d_soles`, s(m.revenue.refunds)],
    ["conversion_prueba_pago", m.conversion.rate == null ? "" : m.conversion.rate.toFixed(4)],
    ["churn_periodo", m.churn.rate == null ? "" : m.churn.rate.toFixed(4)],
    ["costo_ia_usd", m.ai.usd.toFixed(4)], ["costo_ia_soles", s(m.ai.pen)],
    ["costo_ia_promedio_por_analisis_usd", m.ai.perAnalysisUsd == null ? "" : m.ai.perAnalysisUsd.toFixed(4)],
    ["comision_pasarela_soles", s(m.margin.fee)], ["margen_contribucion_soles", s(m.margin.amount)],
    ["reclamos_pendientes", m.complaints.open], ["reclamos_vencidos", m.complaints.overdue],
    ["referidos_registrados", m.referrals.invited], ["referidos_con_pago", m.referrals.rewarded],
  ];
}
