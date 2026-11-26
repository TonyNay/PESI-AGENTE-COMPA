import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { all } from "@/lib/db";
import { analysisDetail } from "@/lib/queries";
import { fmtDate, fmtMoney } from "@/lib/format";
import { Kpi, PageHeader, PositionBadge } from "@/components/ui";
import { AnalyzeButton, LiveTimeline, StaticLog } from "@/components/AnalysisClient";
import { CompetitorBars } from "@/components/charts";
import { PrintButton } from "@/components/PrintButton";
import { AiReviewNotice } from "@/components/AiReviewNotice";
import type { LogRow, Stats } from "@/lib/types";

export const dynamic = "force-dynamic";

function List({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  return (
    <div className="card p-5">
      <h3 className={`mb-2 text-sm font-bold uppercase tracking-wide ${tone}`}>{title}</h3>
      {items.length ? <ul className="list-disc space-y-1.5 pl-5 text-sm">{items.map((t, i) => <li key={i}>{t}</li>)}</ul> : <p className="text-sm text-soft">Sin datos.</p>}
    </div>
  );
}

export default async function AnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { company } = await requireSession();
  const id = Number((await params).id);
  const d = analysisDetail(company.id, id);
  if (!d) notFound();
  const { analysis: a, product: p, offers, result } = d;
  const logs = all<LogRow>("SELECT * FROM agent_logs WHERE analysis_id = ? ORDER BY id", id);
  const title = <>Análisis: {p.name}</>;
  const sub = <><Link href={`/products/${p.id}`} className="text-brand hover:underline">Ver producto</Link> · {a.provider} · {fmtDate(a.finished_at || a.created_at)}</>;

  if (a.status === "queued" || a.status === "running") {
    return (<>
      <PageHeader eyebrow="Agente en acción" title={title} sub={sub} />
      <LiveTimeline analysisId={id} initialLogs={logs} initialStatus={a.status} />
    </>);
  }
  if (a.status === "failed" || !result) {
    return (<>
      <PageHeader eyebrow="Análisis fallido" title={title} sub={sub}><AnalyzeButton productId={p.id} label="Reintentar" /></PageHeader>
      <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-bad"><strong>Error:</strong> {a.error || "Error desconocido"}</div>
      <section className="card p-5"><h2 className="mb-3 font-semibold">Registro del agente</h2><StaticLog logs={logs} /></section>
    </>);
  }

  const s = result.stats as Stats | null;
  const st = result.strategy;
  const cur = p.currency;
  const idxTone = !s ? undefined : s.priceIndex > 105 ? "bad" : s.priceIndex < 95 ? "good" : "warn";
  const chartRows = [{ name: `${company.name} (tú)`, price: p.price, own: true }, ...offers.filter((o) => !o.anomaly).map((o) => ({ name: o.competitor, price: o.price }))];

  return (<>
    <PageHeader eyebrow="Reporte de inteligencia competitiva" title={title} sub={sub}>
      <a className="btn btn-ghost" href={`/api/analyses/${id}/export`}>Exportar CSV</a>
      <PrintButton />
      <AnalyzeButton productId={p.id} label="Volver a analizar" ghost />
    </PageHeader>

    <AiReviewNotice kind="analysis" id={id} reviewedBy={a.reviewed_by} reviewedAt={a.reviewed_at} />
    {result.warning && <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">{result.warning}</p>}

    {s ? (<>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Tu precio" value={fmtMoney(s.ownPrice, cur)} />
        <Kpi label="Mínimo mercado" value={fmtMoney(s.min, cur)} />
        <Kpi label="Máximo mercado" value={fmtMoney(s.max, cur)} />
        <Kpi label="Promedio" value={fmtMoney(s.avg, cur)} />
        <Kpi label="Mediana" value={fmtMoney(s.median, cur)} />
        <Kpi label="Índice de precio" value={s.priceIndex.toFixed(1)} tone={idxTone} hint="propio ÷ promedio × 100" />
        <Kpi label="Percentil" value={`${s.percentile}%`} hint="de competidores son más baratos" />
        <div className="card flex flex-col justify-between p-4"><p className="text-xs font-semibold uppercase tracking-wide text-soft">Posición</p><div className="mt-2"><PositionBadge p={s.position} /></div><p className="mt-1 text-xs text-soft">{s.count} ofertas comparables</p></div>
      </div>

      {st && (
        <section className="card mt-5 border-l-4 border-l-brand p-5">
          <p className="eyebrow">Resumen ejecutivo</p>
          <p className="mt-2 leading-relaxed">{st.resumen_ejecutivo}</p>
          <div className="mt-4 inline-flex flex-wrap items-baseline gap-x-3 rounded-lg bg-[#eef7f5] px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-brand-dark">Precio sugerido</span>
            <span className="display text-2xl font-bold">{fmtMoney(st.precio_sugerido, cur)}</span>
            <span className="text-sm text-soft">{st.justificacion_precio}</span>
          </div>
        </section>
      )}

      <section className="card mt-5 p-5">
        <h2 className="mb-1 font-semibold">Tu precio vs. competidores</h2>
        <p className="mb-2 text-xs text-soft">Barra oscura: tu precio. Línea punteada: promedio del mercado ({fmtMoney(s.avg, cur)}).</p>
        <CompetitorBars rows={chartRows} avg={s.avg} currency={cur} />
      </section>
    </>) : null}

    <section className="card mt-5 overflow-x-auto">
      <h2 className="p-5 pb-3 font-semibold">Competidores ({offers.length})</h2>
      <table className="w-full min-w-[760px] text-sm">
        <thead><tr className="border-y border-line text-left text-xs uppercase tracking-wide text-soft"><th className="px-5 py-2.5">Tienda</th><th className="px-3 py-2.5">Producto encontrado</th><th className="px-3 py-2.5 text-right">Precio</th><th className="px-3 py-2.5 text-right">vs. tú</th><th className="px-3 py-2.5">Disponib.</th><th className="px-3 py-2.5 text-right">Match</th><th className="px-5 py-2.5">Fuente</th></tr></thead>
        <tbody>{offers.map((o) => {
          const diff = ((o.price - p.price) / p.price) * 100;
          return (
            <tr key={o.id} className="border-b border-line last:border-0 align-top">
              <td className="px-5 py-3 font-semibold">{o.competitor}{o.rating ? <div className="text-xs font-normal text-soft">★ {o.rating}</div> : null}</td>
              <td className="px-3 py-3"><div>{o.product_title}</div>{o.features && <div className="text-xs text-soft">{o.features}</div>}{o.anomaly && <div className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs font-medium text-warn">{o.anomaly} No se incluye en las estadísticas.</div>}</td>
              <td className="px-3 py-3 text-right font-semibold tabular-nums">{fmtMoney(o.price, o.currency)}</td>
              <td className={`px-3 py-3 text-right tabular-nums ${diff < 0 ? "text-bad" : "text-good"}`}>{diff > 0 ? "+" : ""}{diff.toFixed(1)}%</td>
              <td className="px-3 py-3 text-soft">{o.availability || "—"}</td>
              <td className="px-3 py-3 text-right tabular-nums">{o.match_score != null ? Math.round(o.match_score * 100) + "%" : "—"}</td>
              <td className="px-5 py-3">{o.url ? <a className="break-all text-brand hover:underline" href={o.url} target="_blank" rel="noreferrer noopener">{new URL(o.url).hostname.replace(/^www\./, "")} ↗</a> : "—"}</td>
            </tr>
          );
        })}</tbody>
      </table>
      <p className="px-5 py-3 text-xs text-soft">“vs. tú”: rojo = el competidor es más barato que tú; verde = más caro. {result.rawOffers} candidatas, {result.keptOffers} conservadas tras normalizar.</p>
    </section>

    {st && (<>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <List title="Fortalezas" items={st.fortalezas} tone="text-good" />
        <List title="Debilidades" items={st.debilidades} tone="text-bad" />
      </div>
      <section className="mt-5">
        <h2 className="mb-3 font-semibold">Análisis FODA</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <List title="Fortalezas" items={st.foda.fortalezas} tone="text-good" />
          <List title="Debilidades" items={st.foda.debilidades} tone="text-bad" />
          <List title="Oportunidades" items={st.foda.oportunidades} tone="text-brand-dark" />
          <List title="Amenazas" items={st.foda.amenazas} tone="text-warn" />
        </div>
      </section>
      <section className="mt-5">
        <h2 className="mb-3 font-semibold">Recomendaciones accionables</h2>
        <ol className="space-y-3">{st.recomendaciones.map((r, i) => (
          <li key={i} className="card flex gap-4 p-4">
            <span className="display flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-white">{i + 1}</span>
            <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{r.titulo}</h3>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.prioridad === "alta" ? "bg-red-50 text-bad" : r.prioridad === "media" ? "bg-amber-50 text-warn" : "bg-slate-100 text-soft"}`}>Prioridad {r.prioridad}</span></div>
              <p className="mt-1 text-sm text-soft">{r.detalle}</p></div>
          </li>))}</ol>
      </section>
    </>)}

    <details className="card no-print mt-5 p-5">
      <summary className="cursor-pointer font-semibold">Registro del agente ({logs.length} eventos){result.meta?.costUsd != null ? ` · costo ≈ US$ ${result.meta.costUsd.toFixed(4)}` : ""}</summary>
      <div className="mt-3"><StaticLog logs={logs} /></div>
    </details>
    <p className="mt-6 text-xs text-soft">Generado por el agente Compa ({result.meta?.provider ?? a.provider}). Los precios provienen de fuentes públicas en el momento del análisis y pueden cambiar; verifica antes de decidir.</p>
  </>);
}
