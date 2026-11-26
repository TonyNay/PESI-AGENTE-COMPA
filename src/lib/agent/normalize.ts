import type { Position, Stats } from "../types";
import { convert, normalizeCurrency } from "./currency";
import type { RawOffer } from "./types";

export type NormalizedOffer = RawOffer & { price: number; currency: string; originalPrice?: number; originalCurrency?: string };

export type NormalizeDecision = "noPrice" | "lowMatch" | "duplicate" | "badCurrency" | "excluded" | "kept" | "converted";

/** Dominios retirados tras un aviso del titular (COMPA_EXCLUDED_DOMAINS, separados por coma). */
function excludedDomains() {
  return (process.env.COMPA_EXCLUDED_DOMAINS || "").split(",").map((d) => d.trim().toLowerCase().replace(/^www\./, "")).filter(Boolean);
}
function isExcluded(url: string | undefined, domains: string[]) {
  if (!url || !domains.length) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return domains.some((d) => host === d || host.endsWith(`.${d}`));
  } catch { return false; }
}

/** Con menos ofertas la mediana no es una referencia confiable. */
const MIN_OFFERS_FOR_ANOMALY = 4;
const ANOMALY_RATIO = 0.5;
export const ANOMALY_REASON = "Precio inusualmente bajo frente a la mediana: verifica su autenticidad o si es comparable.";

/** Separa las ofertas muy por debajo de la mediana: no alteran las estadísticas, pero siguen visibles. */
export function splitAnomalies<T extends { price: number }>(offers: T[]) {
  if (offers.length < MIN_OFFERS_FOR_ANOMALY) return { clean: offers, flagged: [] as T[] };
  const threshold = median([...offers.map((o) => o.price)].sort((a, b) => a - b)) * ANOMALY_RATIO;
  return { clean: offers.filter((o) => o.price >= threshold), flagged: offers.filter((o) => o.price < threshold) };
}

/** `onDecision` (opcional) informa qué se hizo con cada oferta; útil para trazas y depuración. */
export function normalizeOffers(raw: RawOffer[], targetCurrency: string, onDecision?: (o: RawOffer, d: NormalizeDecision, n?: NormalizedOffer) => void) {
  const dropped = { noPrice: 0, lowMatch: 0, duplicate: 0, badCurrency: 0, excluded: 0 };
  const domains = excludedDomains();
  const seen = new Set<string>();
  const kept: NormalizedOffer[] = [];
  for (const o of raw) {
    if (isExcluded(o.url, domains)) { dropped.excluded++; onDecision?.(o, "excluded"); continue; }
    const price = Number(o.price);
    if (!Number.isFinite(price) || price <= 0) { dropped.noPrice++; onDecision?.(o, "noPrice"); continue; }
    const ms = Number(o.match_score);
    if (!Number.isFinite(ms) || ms < 0.5) { dropped.lowMatch++; onDecision?.(o, "lowMatch"); continue; }
    // Un marketplace puede listar varios vendedores en la misma URL: deduplicar por URL + tienda + precio.
    const url = (o.url || o.product_title || "").trim().toLowerCase().replace(/[?#].*$/, "").replace(/\/$/, "");
    const key = `${url}|${(o.competitor || "").trim().toLowerCase()}|${price}`;
    if (seen.has(key)) { dropped.duplicate++; onDecision?.(o, "duplicate"); continue; }
    const cur = normalizeCurrency(o.currency);
    let finalPrice = price;
    let extra: Partial<NormalizedOffer> = {};
    if (cur !== normalizeCurrency(targetCurrency)) {
      const c = convert(price, cur, targetCurrency);
      if (c == null) { dropped.badCurrency++; onDecision?.(o, "badCurrency"); continue; }
      finalPrice = c;
      extra = { originalPrice: price, originalCurrency: cur };
    }
    seen.add(key);
    const n: NormalizedOffer = { ...o, ...extra, price: finalPrice, currency: normalizeCurrency(targetCurrency), match_score: Math.min(1, ms) };
    kept.push(n);
    onDecision?.(o, extra.originalCurrency ? "converted" : "kept", n);
  }
  return { kept, dropped };
}

function median(sorted: number[]) {
  const n = sorted.length;
  return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}
const r2 = (n: number) => Math.round(n * 100) / 100;

export function computeStats(ownPrice: number, currency: string, prices: number[]): Stats | null {
  if (!prices.length) return null;
  const s = [...prices].sort((a, b) => a - b);
  const avg = s.reduce((a, b) => a + b, 0) / s.length;
  const priceIndex = (ownPrice / avg) * 100;
  const percentile = (s.filter((p) => p < ownPrice).length / s.length) * 100;
  const position: Position = priceIndex <= 95 ? "cheaper" : priceIndex > 105 ? "expensive" : "market";
  return {
    ownPrice, currency, count: s.length,
    min: r2(s[0]), max: r2(s[s.length - 1]), avg: r2(avg), median: r2(median(s)),
    priceIndex: r2(priceIndex), percentile: Math.round(percentile), position,
  };
}
