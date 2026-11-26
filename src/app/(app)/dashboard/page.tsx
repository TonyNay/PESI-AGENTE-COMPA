import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { dashboardData } from "@/lib/queries";
import { fmtDate } from "@/lib/format";
import { Empty, Kpi, PageHeader, StatusBadge } from "@/components/ui";
import { PositionPie, PriceBars } from "@/components/charts";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const { company } = await requireSession();
  const d = dashboardData(company.id);
  const idxTone = d.avgIndex == null ? undefined : d.avgIndex > 105 ? "bad" : d.avgIndex < 95 ? "good" : "warn";
  const rows = d.latest.map((l) => ({ name: l.product_name, own: l.price, avg: l.result.stats!.avg, min: l.result.stats!.min, max: l.result.stats!.max }));
  return (
    <>
      <PageHeader eyebrow={company.name} title="Panel de inteligencia competitiva" sub="Resumen del último análisis de cada producto." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Productos y servicios" value={d.products} />
        <Kpi label="Análisis completados" value={d.completed} />
        <Kpi label="Competidores detectados" value={d.competitors} hint="tiendas distintas" />
        <Kpi label="Índice de precio promedio" value={d.avgIndex == null ? "—" : d.avgIndex.toFixed(1)} tone={idxTone}
          hint={d.avgIndex == null ? "Corre un análisis" : d.avgIndex > 105 ? "Más caro que el mercado" : d.avgIndex < 95 ? "Más barato que el mercado" : "Alineado al mercado (100 = promedio)"} />
      </div>

      {rows.length === 0 ? (
        <div className="mt-6"><Empty>Todavía no hay análisis completados. Ve a <Link className="font-semibold text-brand" href="/products">Productos</Link> y pulsa “Analizar mercado”.</Empty></div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <section className="card p-5 lg:col-span-2">
            <h2 className="mb-1 font-semibold">Tu precio vs. mercado por producto</h2>
            <p className="mb-3 text-xs text-soft">Promedio, mínimo y máximo de las ofertas comparables encontradas.</p>
            <PriceBars rows={rows} currency={company.currency} />
          </section>
          <section className="card p-5">
            <h2 className="mb-1 font-semibold">Posición de precio</h2>
            <p className="mb-3 text-xs text-soft">Índice ≤ 95 más barato · 95–105 en mercado · &gt; 105 más caro.</p>
            <PositionPie data={[
              { name: "Más barato", value: d.dist.cheaper, color: "#0e8f7e" },
              { name: "En mercado", value: d.dist.market, color: "#d99a0b" },
              { name: "Más caro", value: d.dist.expensive, color: "#c8412f" },
            ]} />
          </section>
        </div>
      )}

      <section className="card mt-4 p-5">
        <h2 className="mb-3 font-semibold">Análisis recientes</h2>
        {d.recent.length === 0 ? <p className="text-sm text-soft">Sin actividad.</p> : (
          <ul className="divide-y divide-line">
            {d.recent.map((a) => (
              <li key={a.id}>
                <Link href={`/analyses/${a.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5 hover:text-brand">
                  <span className="font-medium">{a.name}</span>
                  <span className="flex items-center gap-3 text-xs text-soft"><span>{a.provider}</span><span>{fmtDate(a.finished_at || a.created_at)}</span><StatusBadge s={a.status} /></span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
