export function fmtMoney(n: number | null | undefined, cur = "PEN") {
  if (n == null || Number.isNaN(n)) return "—";
  const sym = cur === "PEN" ? "S/" : cur === "USD" ? "US$" : cur === "EUR" ? "€" : cur;
  return `${sym} ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
export function parseDbDate(s: string | null | undefined) {
  if (!s) return null;
  const iso = s.includes("T") ? s : s.replace(" ", "T") + "Z";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}
export function fmtDate(s: string | null | undefined) {
  const d = parseDbDate(s);
  return d ? d.toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Lima" }) : "—";
}
export const STATUS_LABEL: Record<string, string> = {
  queued: "En cola", running: "En curso", completed: "Completado", failed: "Fallido",
};
