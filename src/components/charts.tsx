"use client";
import { useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const C = { own: "#12203a", avg: "#0e8f7e", min: "#8ccfc3", max: "#e8730c", grid: "#e4e2da", muted: "#55607a" };
const short = (s: string, n = 18) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

export type PriceRow = { name: string; own: number; avg: number; min: number; max: number };

export function PriceBars({ rows, currency }: { rows: PriceRow[]; currency: string }) {
  const [mode, setMode] = useState<"abs" | "idx">("idx");
  const data = rows.map((r) => {
    const k = mode === "idx" ? 100 / r.avg : 1;
    return { name: short(r.name), full: r.name, "Tu precio": +(r.own * k).toFixed(1), Promedio: +(r.avg * k).toFixed(1), Mínimo: +(r.min * k).toFixed(1), Máximo: +(r.max * k).toFixed(1) };
  });
  return (
    <div>
      <div className="no-print mb-3 inline-flex rounded-lg border border-line p-0.5 text-xs font-semibold" role="group" aria-label="Escala">
        {([["idx", "Índice (promedio = 100)"], ["abs", `Precio (${currency})`]] as const).map(([m, l]) => (
          <button key={m} onClick={() => setMode(m)} className={`rounded-md px-3 py-1.5 ${mode === m ? "bg-ink text-white" : "text-soft"}`}>{l}</button>
        ))}
      </div>
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 24, bottom: 8 }}>
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.muted }} interval={0} angle={-12} textAnchor="end" height={48} />
            <YAxis tick={{ fontSize: 11, fill: C.muted }} />
            {mode === "idx" && <ReferenceLine y={100} stroke={C.muted} strokeDasharray="4 4" />}
            <Tooltip labelFormatter={(_, p) => p?.[0]?.payload?.full} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar isAnimationActive={false} dataKey="Tu precio" fill={C.own} radius={[3, 3, 0, 0]} />
            <Bar isAnimationActive={false} dataKey="Promedio" fill={C.avg} radius={[3, 3, 0, 0]} />
            <Bar isAnimationActive={false} dataKey="Mínimo" fill={C.min} radius={[3, 3, 0, 0]} />
            <Bar isAnimationActive={false} dataKey="Máximo" fill={C.max} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function PositionPie({ data }: { data: { name: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <p className="py-10 text-center text-sm text-soft">Sin análisis completados todavía.</p>;
  return (
    <div>
      <div className="h-52 w-full">
        <ResponsiveContainer>
          <PieChart>
            <Pie isAnimationActive={false} data={data.filter((d) => d.value > 0)} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={2} stroke="#fff">
              {data.filter((d) => d.value > 0).map((d) => <Cell key={d.name} fill={d.color} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 space-y-1.5 text-sm">
        {data.map((d) => (
          <li key={d.name} className="flex items-center justify-between">
            <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{ background: d.color }} />{d.name}</span>
            <span className="font-semibold tabular-nums">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export type OfferPoint = { name: string; price: number; own?: boolean };

/** Barras horizontales: tu precio vs cada competidor, con línea de promedio. */
export function CompetitorBars({ rows, avg, currency }: { rows: OfferPoint[]; avg: number; currency: string }) {
  const data = [...rows].sort((a, b) => a.price - b.price).map((r) => ({ ...r, label: short(r.name, 22) }));
  return (
    <div style={{ height: Math.max(220, data.length * 38 + 50) }} className="w-full">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
          <CartesianGrid stroke={C.grid} horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: C.muted }} domain={[0, "dataMax"]} />
          <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 12, fill: C.muted }} />
          <Tooltip formatter={(v) => [`${currency} ${Number(v).toLocaleString("es-PE")}`, "Precio"]} labelFormatter={(_, p) => p?.[0]?.payload?.name} />
          <ReferenceLine x={avg} stroke={C.avg} strokeDasharray="4 4" label={{ value: "Promedio", fontSize: 11, fill: C.avg, position: "top" }} />
          <Bar isAnimationActive={false} dataKey="price" radius={[0, 4, 4, 0]}>
            {data.map((d, i) => <Cell key={i} fill={d.own ? C.own : C.min} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
