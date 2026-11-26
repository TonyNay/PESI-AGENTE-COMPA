import { all, get } from "@/lib/db";
import { apiSession, json } from "@/lib/api";
import { toCsv } from "@/lib/csv";
import type { AnalysisResult, AnalysisRow, OfferRow, Product } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = await apiSession();
  if ("error" in r) return r.error;
  const id = Number((await params).id);
  const a = get<AnalysisRow>("SELECT * FROM analyses WHERE id = ? AND company_id = ?", id, r.session.company.id);
  if (!a) return json({ error: "No encontrado" }, 404);
  const p = get<Product>("SELECT * FROM products WHERE id = ?", a.product_id)!;
  const offers = all<OfferRow>("SELECT * FROM competitor_offers WHERE analysis_id = ? ORDER BY price", id);
  const res: AnalysisResult | null = a.result_json ? JSON.parse(a.result_json) : null;
  const rows: (string | number | null)[][] = [
    ["Producto propio", p.name, "Precio propio", p.price, "Moneda", p.currency, "Índice de precio", res?.stats?.priceIndex ?? "", "Precio sugerido", res?.strategy?.precio_sugerido ?? ""],
    [],
    ["Competidor", "Título", "Precio", "Moneda", "URL", "Calificación", "Disponibilidad", "Características", "Match score", "Fecha", "Alerta"],
    ...offers.map((o) => [o.competitor, o.product_title, o.price, o.currency, o.url, o.rating, o.availability, o.features, o.match_score, o.scraped_at, o.anomaly]),
  ];
  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="compa-analisis-${id}.csv"`,
    },
  });
}
