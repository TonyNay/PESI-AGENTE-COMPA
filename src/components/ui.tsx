import type { ReactNode } from "react";
import { POSITION_LABEL, type Position } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/format";

export function PageHeader({ eyebrow, title, children, sub }: { eyebrow?: string; title: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="display mt-1 text-2xl font-bold sm:text-3xl">{title}</h1>
        {sub && <p className="mt-1 text-sm text-soft">{sub}</p>}
      </div>
      {children && <div className="no-print flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Kpi({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "good" | "bad" | "warn" }) {
  const color = tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : "text-ink";
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-soft">{label}</p>
      <p className={`display mt-1.5 text-2xl font-bold tabular-nums sm:text-[1.7rem] ${color}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-soft">{hint}</p>}
    </div>
  );
}

export function PositionBadge({ p }: { p: Position }) {
  const cls = p === "cheaper" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : p === "expensive" ? "bg-red-50 text-red-800 border-red-200" : "bg-amber-50 text-amber-800 border-amber-200";
  return <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{POSITION_LABEL[p]}</span>;
}

export function StatusBadge({ s }: { s: string }) {
  const cls = s === "completed" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : s === "failed" ? "bg-red-50 text-red-800 border-red-200" : s === "running" ? "bg-sky-50 text-sky-800 border-sky-200" : "bg-slate-100 text-slate-700 border-slate-200";
  return <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{STATUS_LABEL[s] ?? s}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="card border-dashed p-8 text-center text-sm text-soft">{children}</div>;
}
