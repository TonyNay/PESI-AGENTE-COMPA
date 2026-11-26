import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Kpi, PositionBadge } from "@/components/ui";
import { fmtDate, fmtMoney } from "@/lib/format";
import { sampleReport } from "@/lib/sample-report";
import { registrationOpen } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Ejemplo de reporte de precios · Compa",
  description: "Mira un análisis real del agente de Compa: ofertas de la competencia con su fuente, indicadores de precio, FODA y precio sugerido.",
  alternates: { canonical: "/ejemplo" },
};

export default function SamplePage() {
  const r = sampleReport();
  if (!r) notFound();
  const { stats, strategy } = r.result;
  if (!stats || !strategy) notFound();
  const cur = stats.currency;
  const start = registrationOpen() ? "/register" : "/login";
  const prio = (p: string) => p === "alta" ? "border-red-200 bg-red-50 text-red-800" : p === "media" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-100 text-slate-700";
  return (
    <div>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link href="/" aria-label="Compa, ir al inicio"><Logo /></Link>
        <Link href={start} className="btn btn-primary">Analizar mis productos</Link>
      </header>
      <main className="mx-auto max-w-6xl px-5 pb-16">
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">Reporte real generado por el agente el {fmtDate(r.finishedAt)} para una empresa de demostración. Los precios del mercado cambian: es una muestra, no una cotización vigente.</p>
        <p className="eyebrow mt-6">Ejemplo de análisis de mercado</p>
        <div className="mt-1 flex flex-wrap items-center gap-3"><h1 className="display text-3xl font-bold">{r.productName}</h1><PositionBadge p={stats.position} /></div>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Kpi label="Precio propio" value={fmtMoney(stats.ownPrice, cur)} />
          <Kpi label="Mínimo del mercado" value={fmtMoney(stats.min, cur)} />
          <Kpi label="Mediana" value={fmtMoney(stats.median, cur)} />
          <Kpi label="Índice de precio" value={stats.priceIndex.toFixed(1)} hint="100 = promedio del mercado" tone={stats.priceIndex > 105 ? "bad" : stats.priceIndex < 95 ? "good" : "warn"} />
          <Kpi label="Precio sugerido" value={fmtMoney(strategy.precio_sugerido, cur)} tone="good" />
        </div>

        <section className="card mt-4 p-5">
          <h2 className="font-semibold">Ofertas de la competencia ({r.offers.length})</h2>
          <p className="mb-3 text-xs text-soft">Cada precio conserva el enlace a la página donde el agente lo encontró.</p>
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-soft"><th className="py-2 pr-3">Tienda</th><th className="py-2 pr-3">Producto</th><th className="py-2 pr-3 text-right">Precio</th><th className="py-2">Fuente</th></tr></thead>
            <tbody>{[...r.offers].sort((a, b) => a.price - b.price).map((o, i) => (
              <tr key={i} className="border-b border-line/70"><td className="py-2 pr-3 font-medium">{o.competitor}</td><td className="py-2 pr-3 text-soft">{o.product_title}</td><td className="py-2 pr-3 text-right tabular-nums">{fmtMoney(o.price, o.currency)}</td>
                <td className="py-2">{o.url ? <a className="text-brand underline" href={o.url} target="_blank" rel="nofollow noopener noreferrer">Ver página</a> : "—"}</td></tr>))}</tbody>
          </table></div>
        </section>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className="card p-5"><h2 className="font-semibold">Resumen ejecutivo</h2><p className="mt-2 text-sm leading-relaxed">{strategy.resumen_ejecutivo}</p>
            <h3 className="mt-4 text-sm font-semibold">Por qué ese precio</h3><p className="mt-1 text-sm leading-relaxed text-soft">{strategy.justificacion_precio}</p></section>
          <section className="card p-5"><h2 className="font-semibold">Recomendaciones</h2>
            <ul className="mt-2 space-y-3">{strategy.recomendaciones.slice(0, 4).map((x) => (
              <li key={x.titulo} className="text-sm"><span className={`mr-2 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${prio(x.prioridad)}`}>{x.prioridad}</span><strong>{x.titulo}</strong><p className="mt-1 text-soft">{x.detalle}</p></li>))}</ul></section>
        </div>

        <section className="card mt-4 p-5">
          <h2 className="font-semibold">Análisis FODA</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {([["Fortalezas", strategy.foda.fortalezas, "#eef7f5"], ["Debilidades", strategy.foda.debilidades, "#fbf0ee"], ["Oportunidades", strategy.foda.oportunidades, "#eef3fb"], ["Amenazas", strategy.foda.amenazas, "#fbf6e8"]] as const).map(([t, items, bg]) => (
              <div key={t} className="rounded-lg p-4" style={{ background: bg }}><h3 className="text-sm font-semibold">{t}</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{items.slice(0, 3).map((x) => <li key={x}>{x}</li>)}</ul></div>))}
          </div>
        </section>

        <p className="mt-4 text-xs text-soft">Contenido generado con inteligencia artificial y revisado por el equipo. La decisión final de precio es siempre de la empresa.</p>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#0f1b33] p-8 text-white">
          <div><h2 className="display text-2xl font-bold">¿Quieres este reporte para tus productos?</h2><p className="mt-1 text-slate-300">La prueba gratuita incluye 5 análisis de precios y 1 análisis estratégico.</p></div>
          <Link href={start} className="btn btn-primary">Empezar ahora</Link>
        </div>
      </main>
    </div>
  );
}
