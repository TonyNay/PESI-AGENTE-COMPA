import Link from "next/link";
import { notFound } from "next/navigation";
import { Kpi, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { soles } from "@/lib/billing/catalog";
import { getDb } from "@/lib/db";
import { GATEWAY_FEE_RATE, platformMetrics, USD_TO_PEN, type MetricsMode } from "@/lib/metrics";
import { isPlatformAdmin } from "@/lib/platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pct = (v: number | null) => v == null ? "—" : `${(v * 100).toFixed(1)} %`;
const MODES: [MetricsMode, string][] = [["all", "Todo"], ["TEST", "Culqi TEST"], ["SIMULATED", "Simulador"]];

export default async function MetricsPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { user } = await requireSession();
  if (!isPlatformAdmin(user.email)) notFound();
  const requested = (await searchParams).mode;
  const mode: MetricsMode = requested === "TEST" || requested === "SIMULATED" ? requested : "all";
  const m = platformMetrics(getDb(), { mode });
  const maxDay = Math.max(1, ...m.daily.map((d) => d.gross));
  return <>
    <PageHeader eyebrow="Administración de Compa" title="Métricas del negocio" sub={`Últimos ${m.windowDays} días · datos medidos en la plataforma, no estimados.`}>
      <nav className="flex rounded-lg border border-line bg-white p-0.5 text-sm" aria-label="Entorno de pagos">
        {MODES.map(([k, l]) => <Link key={k} href={k === "all" ? "/admin/metrics" : `/admin/metrics?mode=${k}`} aria-current={mode === k ? "page" : undefined} className={`rounded-md px-3 py-1.5 ${mode === k ? "bg-[#0f1b33] text-white" : "text-soft hover:text-ink"}`}>{l}</Link>)}
      </nav>
      <a className="btn btn-ghost" href={`/api/admin/metrics?mode=${mode}`}>Descargar CSV</a>
    </PageHeader>

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Kpi label="MRR (ingreso recurrente)" value={soles(m.mrr.gross)} hint={`Valor de venta ${soles(m.mrr.base)} · ${m.companies.active} planes vigentes`} />
      <Kpi label="Conversión prueba → pago" value={pct(m.conversion.rate)} hint={`${m.conversion.paying} de ${m.conversion.total} empresas pagaron alguna vez`} />
      <Kpi label="Cancelación (churn)" value={pct(m.churn.rate)} tone={m.churn.rate != null && m.churn.rate > 0.1 ? "bad" : undefined} hint={`${m.churn.churned} planes vencieron sin renovar en ${m.windowDays} días`} />
      <Kpi label="Ingreso promedio por cliente" value={soles(m.arpa)} hint="ARPA mensual con IGV" />
      <Kpi label={`Ingresos ${m.windowDays} días`} value={soles(m.revenue.net)} hint={`${m.revenue.payments} pagos · ${m.revenue.refundCount} reembolsos (${soles(m.revenue.refunds)})`} />
      <Kpi label="Costo de IA" value={soles(m.ai.pen)} hint={`US$ ${m.ai.usd.toFixed(2)} · ${m.ai.priceAnalyses} de precios y ${m.ai.strategic} estratégicos${m.ai.perAnalysisUsd != null ? ` · US$ ${m.ai.perAnalysisUsd.toFixed(3)} c/u` : ""}`} />
      <Kpi label="Margen de contribución" value={soles(m.margin.amount)} tone={m.margin.amount < 0 ? "bad" : "good"} hint={`Valor de venta − comisión (${soles(m.margin.fee)}) − IA`} />
      <Kpi label="Empresas" value={m.companies.total} hint={`${m.companies.trial} solo en prueba · ${m.companies.expired} con plan vencido`} />
    </div>

    <div className="mt-4 grid gap-4 lg:grid-cols-3">
      <section className="card p-5 lg:col-span-2">
        <h2 className="font-semibold">Ingresos diarios</h2>
        <p className="mb-3 text-xs text-soft">Pagos confirmados por día (con IGV).</p>
        <div className="flex h-40 items-end gap-[3px]" role="img" aria-label="Gráfico de barras de ingresos diarios">
          {m.daily.map((d) => <div key={d.day} title={`${d.day}: ${soles(d.gross)}`} className="flex-1 rounded-t-sm bg-[#0e8f7e]" style={{ height: `${Math.max(d.gross ? 4 : 1, (d.gross / maxDay) * 100)}%`, opacity: d.gross ? 1 : 0.15 }} />)}
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-soft"><span>{m.daily[0]?.day}</span><span>{m.daily.at(-1)?.day}</span></div>
      </section>
      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Planes vigentes</h2>
        <ul className="space-y-3 text-sm">{m.byPlan.map((p) => (
          <li key={p.planId}><div className="flex justify-between"><span>{p.name}</span><span className="tabular-nums">{p.active} · {soles(p.mrr)}</span></div>
            <div className="mt-1 h-2 rounded bg-[#ecebe6]"><div className="h-2 rounded bg-[#12253b]" style={{ width: `${m.companies.active ? (p.active / m.companies.active) * 100 : 0}%` }} /></div></li>))}
        </ul>
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
          <div><p className="text-soft">Reclamos pendientes</p><p className={`text-lg font-semibold ${m.complaints.overdue ? "text-bad" : ""}`}>{m.complaints.open}{m.complaints.overdue ? ` (${m.complaints.overdue} vencidos)` : ""}</p><Link className="text-xs text-brand underline" href="/admin/reclamaciones">Ver libro</Link></div>
          <div><p className="text-soft">Referidos</p><p className="text-lg font-semibold">{m.referrals.rewarded} / {m.referrals.invited}</p><p className="text-xs text-soft">con pago / registrados</p></div>
        </div>
      </section>
    </div>

    <section className="card mt-4 p-5">
      <h2 className="font-semibold">Rentabilidad por cliente</h2>
      <p className="mb-3 text-xs text-soft">Ingreso del periodo frente a su costo de IA. Un margen negativo indica que el plan no cubre el uso, como advierte el análisis del plan Empresa.</p>
      {m.topCompanies.length === 0 ? <p className="text-sm text-soft">Sin pagos ni análisis en el periodo.</p> : <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-soft"><th className="py-2 pr-3">Empresa</th><th className="py-2 pr-3">Plan vigente</th><th className="py-2 pr-3 text-right">Análisis</th><th className="py-2 pr-3 text-right">Ingreso</th><th className="py-2 pr-3 text-right">Costo IA</th><th className="py-2 text-right">Margen</th></tr></thead>
        <tbody>{m.topCompanies.map((c) => <tr key={c.companyId} className="border-b border-line/70">
          <td className="py-2 pr-3 font-medium">{c.name}</td><td className="py-2 pr-3">{c.plan ?? "Prueba / vencido"}</td><td className="py-2 pr-3 text-right tabular-nums">{c.analyses}</td>
          <td className="py-2 pr-3 text-right tabular-nums">{soles(c.revenue)}</td><td className="py-2 pr-3 text-right tabular-nums">{soles(c.aiCostPen)}</td>
          <td className={`py-2 text-right font-semibold tabular-nums ${c.margin < 0 ? "text-bad" : "text-good"}`}>{soles(c.margin)}</td></tr>)}</tbody>
      </table></div>}
      <p className="mt-3 text-xs text-soft">Supuestos: comisión de la pasarela {(GATEWAY_FEE_RATE * 100).toFixed(1)} % del precio con IGV; tipo de cambio referencial S/ {USD_TO_PEN.toFixed(2)} por dólar (el mismo que usa el agente). No incluye hosting, dominio ni marketing.</p>
    </section>
  </>;
}
