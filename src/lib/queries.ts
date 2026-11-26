import { all, get } from "./db";
import type { AnalysisResult, AnalysisRow, OfferRow, Position, Product } from "./types";

export type LatestRow = {
  analysis_id: number; product_id: number; product_name: string; currency: string; price: number;
  finished_at: string; result: AnalysisResult;
};

/** Último análisis completado por producto. */
export function latestCompleted(companyId: number): LatestRow[] {
  const rows = all<{ id: number; product_id: number; name: string; currency: string; price: number; finished_at: string; result_json: string }>(
    `SELECT a.id, a.product_id, p.name, p.currency, p.price, a.finished_at, a.result_json
     FROM analyses a JOIN products p ON p.id = a.product_id
     WHERE a.company_id = ? AND a.status = 'completed' AND a.id = (
       SELECT MAX(id) FROM analyses WHERE product_id = a.product_id AND status = 'completed')
     ORDER BY p.name`, companyId);
  return rows.map((r) => ({
    analysis_id: r.id, product_id: r.product_id, product_name: r.name, currency: r.currency, price: r.price,
    finished_at: r.finished_at, result: JSON.parse(r.result_json) as AnalysisResult,
  }));
}

export function dashboardData(companyId: number) {
  const products = get<{ n: number }>("SELECT COUNT(*) n FROM products WHERE company_id = ?", companyId)!.n;
  const completed = get<{ n: number }>("SELECT COUNT(*) n FROM analyses WHERE company_id = ? AND status='completed'", companyId)!.n;
  const latest = latestCompleted(companyId);
  const competitors = latest.length
    ? get<{ n: number }>(
        `SELECT COUNT(DISTINCT LOWER(competitor)) n FROM competitor_offers WHERE analysis_id IN (${latest.map(() => "?").join(",")})`,
        ...latest.map((l) => l.analysis_id))!.n
    : 0;
  const withStats = latest.filter((l) => l.result.stats);
  const avgIndex = withStats.length ? withStats.reduce((s, l) => s + l.result.stats!.priceIndex, 0) / withStats.length : null;
  const dist: Record<Position, number> = { cheaper: 0, market: 0, expensive: 0 };
  withStats.forEach((l) => dist[l.result.stats!.position]++);
  const recent = all<{ id: number; status: string; finished_at: string | null; created_at: string; name: string; provider: string }>(
    `SELECT a.id, a.status, a.finished_at, a.created_at, p.name, a.provider FROM analyses a JOIN products p ON p.id=a.product_id
     WHERE a.company_id = ? ORDER BY a.id DESC LIMIT 8`, companyId);
  return { products, completed, competitors, avgIndex, dist, recent, latest: withStats };
}

export function analysisDetail(companyId: number, id: number) {
  const a = get<AnalysisRow>("SELECT * FROM analyses WHERE id = ? AND company_id = ?", id, companyId);
  if (!a) return null;
  const product = get<Product>("SELECT * FROM products WHERE id = ?", a.product_id)!;
  const offers = all<OfferRow>("SELECT * FROM competitor_offers WHERE analysis_id = ? ORDER BY price ASC", id);
  const result: AnalysisResult | null = a.result_json ? JSON.parse(a.result_json) : null;
  return { analysis: a, product, offers, result };
}
