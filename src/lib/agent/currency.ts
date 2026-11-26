/** Tabla fija simple: valor de 1 unidad de la moneda expresado en PEN. Referencial. */
export const RATES_TO_PEN: Record<string, number> = {
  PEN: 1, USD: 3.75, EUR: 4.1, MXN: 0.2, COP: 0.00092, CLP: 0.004, ARS: 0.004, BRL: 0.68, GBP: 4.8,
};

export function normalizeCurrency(c: string | undefined | null): string {
  const v = (c || "").trim().toUpperCase();
  if (v === "S/" || v === "S/." || v === "SOLES" || v === "PEN") return "PEN";
  if (v === "$" || v === "US$" || v === "USD" || v === "DOLARES") return "USD";
  return v || "PEN";
}

export function convert(amount: number, from: string, to: string): number | null {
  const f = RATES_TO_PEN[normalizeCurrency(from)];
  const t = RATES_TO_PEN[normalizeCurrency(to)];
  if (!f || !t) return null;
  return Math.round(((amount * f) / t) * 100) / 100;
}
