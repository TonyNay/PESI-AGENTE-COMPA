import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { all } from "@/lib/db";
import { getProduct } from "@/lib/products";
import { fmtDate, fmtMoney } from "@/lib/format";
import { Empty, PageHeader, PositionBadge, StatusBadge } from "@/components/ui";
import { AnalyzeButton } from "@/components/AnalysisClient";
import type { AnalysisResult } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { company } = await requireSession();
  const p = getProduct(company.id, Number((await params).id));
  if (!p) notFound();
  const rows = all<{ id: number; status: string; provider: string; created_at: string; finished_at: string | null; result_json: string | null; n: number }>(
    `SELECT a.id, a.status, a.provider, a.created_at, a.finished_at, a.result_json,
      (SELECT COUNT(*) FROM competitor_offers o WHERE o.analysis_id = a.id) n
     FROM analyses a WHERE a.product_id = ? ORDER BY a.id DESC`, p.id);
  const field = (l: string, v: React.ReactNode) => (<div><dt className="text-xs font-semibold uppercase tracking-wide text-soft">{l}</dt><dd className="mt-0.5 text-sm">{v || "—"}</dd></div>);
  return (
    <>
      <PageHeader eyebrow={p.type === "servicio" ? "Servicio" : "Producto"} title={p.name} sub={<Link href="/products" className="text-brand hover:underline">← Volver a productos</Link>}>
        <AnalyzeButton productId={p.id} />
      </PageHeader>
      <section className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        {field("Precio", <span className="display text-xl font-bold">{fmtMoney(p.price, p.currency)}</span>)}
        {field("Marca", p.brand)}
        {field("Categoría", p.category)}
        {field("SKU", p.sku)}
        <div className="sm:col-span-2">{field("Descripción", p.description)}</div>
        {field("Palabras clave", p.keywords)}
        {field("URL propia", p.url ? <a className="text-brand hover:underline" href={p.url} target="_blank" rel="noreferrer">{p.url}</a> : null)}
      </section>
      <h2 className="mb-3 mt-8 font-semibold">Historial de análisis</h2>
      {rows.length === 0 ? <Empty>Aún no has analizado este ítem.</Empty> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-soft"><th className="px-4 py-3">Fecha</th><th className="px-3 py-3">Estado</th><th className="px-3 py-3">Proveedor</th><th className="px-3 py-3 text-right">Ofertas</th><th className="px-3 py-3 text-right">Índice</th><th className="px-3 py-3">Posición</th><th className="px-4 py-3" /></tr></thead>
            <tbody>{rows.map((a) => {
              const r: AnalysisResult | null = a.result_json ? JSON.parse(a.result_json) : null;
              return (
                <tr key={a.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">{fmtDate(a.finished_at || a.created_at)}</td>
                  <td className="px-3 py-3"><StatusBadge s={a.status} /></td>
                  <td className="px-3 py-3 text-soft">{a.provider}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{a.n}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{r?.stats?.priceIndex ?? "—"}</td>
                  <td className="px-3 py-3">{r?.stats ? <PositionBadge p={r.stats.position} /> : "—"}</td>
                  <td className="px-4 py-3 text-right"><Link className="font-semibold text-brand hover:underline" href={`/analyses/${a.id}`}>Ver reporte</Link></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}
    </>
  );
}
