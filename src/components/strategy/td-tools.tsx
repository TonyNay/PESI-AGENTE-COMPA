"use client";
// Paneles interactivos de los agentes 1 a 7 de la fase III.
import { AnimatePresence, motion } from "motion/react";
import { Fragment, useMemo, useState, type ReactNode } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  ALIGN_CLS, ALIGN_LABEL, AREAS, BUDGET_CATEGORIES, PARETO_CRITERIA, computeBudget, computePareto, gapIndex, kpiChecks, kpiCoverage,
  lineAnnual, literatureStats, money, planStrategies, sciCite, sciParts,
} from "@/lib/td";
import type {
  AlignLevel, BudgetLine, DigitalProposal, GapRow, KpiCard, Origen, ScientificRef, StdRow, StdSituation, TechBudget,
} from "@/lib/types";
import { CiteText, useRefs } from "./cite";
import { CountUp, Gauge, Segmented } from "./motion-kit";
import {
  Bullets, Field, OrigenBadge, OrigenLegend, Td, TdBar, Th, Tile, clone, countOrigen, downloadCsv, type TdProps,
} from "./td-kit";

const C = { ink: "#12203a", brand: "#0e8f7e", accent: "#e8730c", soft: "#8ccfc3", grid: "#e4e2da", muted: "#55607a", b: "#d99a0b", c: "#c9c6ba" };
const PIE = ["#0e8f7e", "#12203a", "#e8730c", "#5b8def", "#d99a0b", "#8ccfc3", "#c8412f", "#7a5af8", "#55607a", "#c9c6ba"];
const SIT: Record<StdSituation, { label: string; cls: string }> = {
  existente: { label: "Existente", cls: "bg-emerald-100 text-emerald-800" },
  mejorar: { label: "Mejorar", cls: "bg-amber-100 text-amber-800" },
  nueva: { label: "Nueva", cls: "bg-violet-100 text-violet-800" },
};
const short = (s: string, n = 22) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

// =============== 1. Estrategias y tecnologías digitales ===============
export function StdTool(p: TdProps) {
  const m = p.result.plan.std;
  const refs = useRefs(p.result);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m);
  const [sit, setSit] = useState<StdSituation | null>(null);
  const [view, setView] = useState<"arbol" | "matriz">("arbol");
  if (!m) return null;
  const data = editing && draft ? draft : m;
  const setRow = (i: number, patch: Partial<StdRow>) => setDraft((d) => d && { ...d, filas: d.filas.map((f, j) => (j === i ? { ...f, ...patch, origen: "usuario" as Origen } : f)) });
  const byObj = [...new Set(data.filas.map((f) => f.objetivo))];
  const rows = data.filas.filter((f) => !sit || f.situacion === sit);
  return (
    <div>
      <TdBar k="std" p={p} editing={editing} setEditing={(v) => { setDraft(clone(m)); setEditing(v); if (v) setView("matriz"); }} onSave={() => draft ?? null}
        exports={[{ label: "CSV", run: () => downloadCsv("matriz-std", [["ID", "Estrategia", "Objetivo", "Vínculo misión/visión", "S/TD", "Categoría", "Situación", "Capacidad actual", "Finalidad", "Justificación", "Aporte", "Procedencia"], ...m.filas.map((f) => [f.id, f.estrategia, f.objetivo, f.vinculo, f.std, f.categoria, f.situacion, f.capacidad_actual, f.finalidad, f.justificacion, f.aporte, f.origen])]) }]} />
      <div className="grid gap-2 sm:grid-cols-4">
        <Tile i={0} label="Estrategias con S/TD" value={<CountUp value={m.filas.length} />} hint={`${planStrategies(p.result.plan).length} estrategias en el plan`} />
        {(Object.keys(SIT) as StdSituation[]).map((k, i) => (
          <button key={k} type="button" onClick={() => setSit(sit === k ? null : k)} className={`text-left ${sit && sit !== k ? "opacity-50" : ""}`}>
            <Tile i={i + 1} label={SIT[k].label} value={<CountUp value={m.filas.filter((f) => f.situacion === k).length} />} hint={k === "existente" ? "se reutiliza lo que ya tiene" : k === "mejorar" ? "se amplía una capacidad actual" : "requiere tecnología nueva"} />
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="card relative overflow-hidden p-4"><div className="absolute inset-y-0 left-0 w-1 bg-brand" /><p className="label">Visión</p><p className="text-sm">{p.result.plan.vision?.texto ?? m.alineacion.vision}</p></div>
        <div className="card relative overflow-hidden p-4"><div className="absolute inset-y-0 left-0 w-1 bg-accent" /><p className="label">Misión</p><p className="text-sm">{p.result.plan.mision?.texto ?? m.alineacion.mision}</p></div>
      </div>
      <CiteText text={m.alineacion.lectura} refs={refs} className="mt-3 text-sm leading-relaxed text-soft" />

      {m.capacidades_actuales.length > 0 && (
        <div className="mt-4 card p-4">
          <p className="label">Capacidades digitales actuales</p>
          <div className="flex flex-wrap gap-2">{m.capacidades_actuales.map((c, i) => (
            <span key={i} title={`${c.uso} · ${c.evidencia}`} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-[#fbfaf7] px-3 py-1 text-sm">{c.sistema}<OrigenBadge o={c.origen} /></span>
          ))}</div>
        </div>
      )}

      <div className="mb-3 mt-5 flex flex-wrap items-center justify-between gap-2">
        <Segmented id="std" value={view} onChange={setView} options={[{ key: "arbol", label: "Visión → objetivos → estrategias → S/TD" }, { key: "matriz", label: "Matriz estrategia – S/TD" }]} />
        <OrigenLegend counts={countOrigen(m.filas)} />
      </div>
      <AnimatePresence mode="wait">
        {view === "arbol" ? (
          <motion.div key="a" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            {byObj.map((o) => (
              <div key={o} className="card grid gap-3 p-4 md:grid-cols-[14rem_1fr]">
                <div><p className="text-[10px] font-bold uppercase tracking-wider text-brand-dark">Objetivo</p><p className="text-sm font-semibold">{o}</p></div>
                <div className="space-y-2">{rows.filter((f) => f.objetivo === o).map((f) => (
                  <div key={f.id} className="grid items-center gap-2 rounded-xl bg-[#fbfaf7] p-2.5 sm:grid-cols-[1fr_auto_1fr]">
                    <p className="text-sm"><span className="mr-1 rounded bg-ink px-1.5 py-0.5 text-[10px] font-bold text-white">{f.id}</span>{f.estrategia}</p>
                    <span className="hidden text-soft sm:block">→</span>
                    <p className="text-sm"><span className={`mr-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold ${SIT[f.situacion].cls}`}>{SIT[f.situacion].label}</span><strong>{f.std}</strong> <span className="text-xs text-soft">· {f.categoria}</span></p>
                  </div>
                ))}</div>
              </div>
            ))}
          </motion.div>
        ) : (
          <motion.div key="m" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="card overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead><tr className="border-b border-line"><Th>ID</Th><Th>Estrategia</Th><Th>S/TD</Th><Th>Situación</Th><Th>Finalidad</Th><Th>Justificación</Th><Th>Aporte esperado</Th><Th>Proc.</Th></tr></thead>
              <tbody>{rows.map((f) => { const i = data.filas.indexOf(f); return (
                <tr key={f.id} className="border-b border-line last:border-0 hover:bg-[#fbfaf7]">
                  <Td className="font-bold">{f.id}</Td>
                  <Td><p>{f.estrategia}</p><p className="text-xs text-soft">Objetivo: {f.objetivo}</p></Td>
                  <Td>{editing ? <Field value={f.std} onChange={(v) => setRow(i, { std: v })} /> : <><strong>{f.std}</strong><p className="text-xs text-soft">{f.categoria} · actual: {f.capacidad_actual}</p></>}</Td>
                  <Td>{editing
                    ? <select className="input !px-2 !py-1 text-xs" value={f.situacion} onChange={(e) => setRow(i, { situacion: e.target.value as StdSituation })}>{(Object.keys(SIT) as StdSituation[]).map((k) => <option key={k} value={k}>{SIT[k].label}</option>)}</select>
                    : <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${SIT[f.situacion].cls}`}>{SIT[f.situacion].label}</span>}</Td>
                  <Td>{editing ? <Field area value={f.finalidad} onChange={(v) => setRow(i, { finalidad: v })} /> : f.finalidad}</Td>
                  <Td className="text-soft">{editing ? <Field area value={f.justificacion} onChange={(v) => setRow(i, { justificacion: v })} /> : <CiteText text={f.justificacion} refs={refs} />}</Td>
                  <Td>{editing ? <Field area value={f.aporte} onChange={(v) => setRow(i, { aporte: v })} /> : f.aporte}</Td>
                  <Td><OrigenBadge o={f.origen} /></Td>
                </tr>
              ); })}</tbody>
            </table>
          </motion.div>
        )}
      </AnimatePresence>
      <CiteText text={m.conclusion} refs={refs} className="mt-4 rounded-xl bg-[#eef7f5] px-4 py-3 text-sm leading-relaxed" />
    </div>
  );
}

// =============== 2. Pareto ===============
export function ParetoTool(p: TdProps) {
  const pa = p.result.plan.pareto, std = p.result.plan.std;
  const refs = useRefs(p.result);
  const [weights, setWeights] = useState<Record<string, number> | null>(null);
  const [corte, setCorte] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(pa);
  const [open, setOpen] = useState<string | null>(null);
  const base = editing && draft ? draft : pa;
  const w = useMemo(() => weights ?? Object.fromEntries((base?.criterios ?? []).map((c) => [c.key, c.peso])), [weights, base]);
  const calc = useMemo(() => base && computePareto({ ...base, corte: corte ?? base.corte }, std, w), [base, std, w, corte]);
  if (!pa || !calc || !base) return null;
  const dirtyWeights = weights != null || corte != null;
  const sumW = Object.values(w).reduce((s, x) => s + x, 0) || 1;
  const chart = calc.rows.map((r) => ({ name: r.id, full: `${r.id} · ${r.estrategia}`, Aporte: r.share, Acumulado: r.cum, clase: r.clase }));
  const crit = base.criterios.length ? base.criterios : PARETO_CRITERIA.map((c) => ({ ...c, descripcion: "", peso: 0.2 }));
  const setScore = (id: string, key: string, valor: number) => setDraft((d) => d && { ...d, evaluaciones: d.evaluaciones.map((e) => e.id !== id ? e : { ...e, origen: "usuario" as Origen, puntajes: e.puntajes.some((x) => x.criterio === key) ? e.puntajes.map((x) => x.criterio === key ? { ...x, valor, justificacion: `${x.justificacion} (ajustado por el usuario)` } : x) : [...e.puntajes, { criterio: key, valor, justificacion: "Ajustado por el usuario" }] }) });
  const saveData = () => ({ ...(editing && draft ? draft : pa), corte: corte ?? pa.corte, criterios: (editing && draft ? draft : pa).criterios.map((c) => ({ ...c, peso: Math.round(((w[c.key] ?? c.peso) / sumW) * 1000) / 1000 })) });
  return (
    <div>
      <TdBar k="pareto" p={p} editing={editing} setEditing={(v) => { setDraft(clone(pa)); setEditing(v); }} onSave={saveData}
        exports={[{ label: "CSV", run: () => downloadCsv("priorizacion-pareto", [["Orden", "ID", "Estrategia", "S/TD", ...crit.map((c) => `${c.nombre} (peso ${(w[c.key] / sumW).toFixed(2)})`), "Puntaje ponderado", "% aporte", "% acumulado", "Clase"], ...calc.rows.map((r, i) => [i + 1, r.id, r.estrategia, r.std, ...crit.map((c) => base.evaluaciones.find((e) => e.id === r.id)?.puntajes.find((x) => x.criterio === c.key)?.valor ?? 1), r.score, r.share, r.cum, r.clase])]) }]}>
        {dirtyWeights && !editing && p.id && !p.live && <SaveWeights p={p} data={saveData} onDone={() => { setWeights(null); setCorte(null); }} />}
      </TdBar>

      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <div className="card p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">Gráfico de Pareto</p>
            <span className="flex items-center gap-3 text-xs text-soft"><span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-brand" />A</span><span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-warn" />B</span><span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-[#c9c6ba]" />C</span></span>
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <ComposedChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid stroke={C.grid} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.muted }} />
                <YAxis yAxisId="l" tick={{ fontSize: 11, fill: C.muted }} unit="%" />
                <YAxis yAxisId="r" orientation="right" domain={[0, 100]} tick={{ fontSize: 11, fill: C.muted }} unit="%" />
                <Tooltip labelFormatter={(_, x) => x?.[0]?.payload?.full} formatter={(v) => `${v} %`} />
                <ReferenceLine yAxisId="r" y={corte ?? base.corte ?? 80} stroke={C.accent} strokeDasharray="5 4" label={{ value: `${corte ?? base.corte ?? 80} %`, fill: C.accent, fontSize: 11, position: "insideTopLeft" }} />
                <Bar yAxisId="l" dataKey="Aporte" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {chart.map((d) => <Cell key={d.name} fill={d.clase === "A" ? C.brand : d.clase === "B" ? C.b : C.c} />)}
                </Bar>
                <Line yAxisId="r" dataKey="Acumulado" stroke={C.ink} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className={`mt-2 rounded-xl px-4 py-3 text-sm ${calc.cumple ? "bg-[#eef7f5]" : "bg-amber-50"}`}><strong>{calc.cumple ? "Se aproxima a 80/20. " : "No se cumple 80/20. "}</strong>{calc.mensaje}</p>
        </div>
        <div className="card space-y-3 p-4">
          <p className="font-semibold">Ponderaciones</p>
          <p className="text-xs text-soft">Mueve los pesos: el orden, el gráfico y las clases se recalculan al instante. Se normalizan para sumar 100 %.</p>
          {crit.map((c) => (
            <label key={c.key} className="block text-sm" title={c.descripcion}>
              <span className="flex justify-between"><span>{c.nombre}</span><span className="tabular-nums font-semibold">{Math.round(((w[c.key] ?? 0) / sumW) * 100)} %</span></span>
              <input type="range" min={0} max={1} step={0.05} value={w[c.key] ?? 0} onChange={(e) => setWeights({ ...w, [c.key]: Number(e.target.value) })} className="w-full accent-[var(--brand)]" />
            </label>
          ))}
          <label className="block text-sm"><span className="flex justify-between"><span>Corte de la clase A</span><span className="font-semibold tabular-nums">{corte ?? base.corte ?? 80} %</span></span>
            <input type="range" min={60} max={90} step={5} value={corte ?? base.corte ?? 80} onChange={(e) => setCorte(Number(e.target.value))} className="w-full accent-[var(--accent)]" /></label>
          {dirtyWeights && <button type="button" className="text-xs font-semibold text-brand hover:underline" onClick={() => { setWeights(null); setCorte(null); }}>Restablecer valores guardados</button>}
        </div>
      </div>

      <div className="card mt-4 overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead><tr className="border-b border-line"><Th>#</Th><Th>Estrategia · S/TD</Th>{crit.map((c) => <Th key={c.key} className="text-center">{c.nombre}<br /><span className="normal-case tracking-normal">{Math.round(((w[c.key] ?? 0) / sumW) * 100)} %</span></Th>)}<Th className="text-right">Puntaje</Th><Th className="text-right">% aporte</Th><Th className="text-right">% acum.</Th><Th>Clase</Th></tr></thead>
          <tbody>{calc.rows.map((r, i) => {
            const e = base.evaluaciones.find((x) => x.id === r.id);
            return (
              <Fragment key={r.id}>
                <motion.tr layout className="cursor-pointer border-b border-line hover:bg-[#fbfaf7]" onClick={() => setOpen(open === r.id ? null : r.id)}>
                  <Td className="font-bold">{i + 1}</Td>
                  <Td><span className="mr-1 rounded bg-ink px-1.5 py-0.5 text-[10px] font-bold text-white">{r.id}</span>{r.estrategia}<p className="text-xs text-soft">{r.std}</p></Td>
                  {crit.map((c) => { const v = e?.puntajes.find((x) => x.criterio === c.key)?.valor ?? 1; return (
                    <Td key={c.key} className="text-center">{editing
                      ? <select onClick={(ev) => ev.stopPropagation()} className="input !w-14 !px-1 !py-0.5 text-xs" value={v} onChange={(ev) => setScore(r.id, c.key, Number(ev.target.value))}>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select>
                      : <span className="inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold" style={{ background: `rgba(14,143,126,${v / 5})`, color: v >= 3 ? "#fff" : "var(--ink)" }}>{v}</span>}</Td>
                  ); })}
                  <Td className="text-right font-semibold tabular-nums">{r.score.toFixed(2)}</Td>
                  <Td className="text-right tabular-nums">{r.share.toFixed(1)}</Td>
                  <Td className="text-right tabular-nums">{r.cum.toFixed(1)}</Td>
                  <Td><span className={`rounded px-2 py-0.5 text-xs font-bold ${r.clase === "A" ? "bg-brand text-white" : r.clase === "B" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-soft"}`}>{r.clase}</span></Td>
                </motion.tr>
                {open === r.id && e && (
                  <tr className="border-b border-line bg-[#fbfaf7]"><td colSpan={crit.length + 6} className="px-4 py-3 text-xs">
                    <p className="mb-1 flex items-center gap-2"><strong>Sustento de los puntajes</strong><OrigenBadge o={e.origen} /></p>
                    <ul className="grid gap-1 md:grid-cols-2">{e.puntajes.map((x) => <li key={x.criterio}><strong>{crit.find((c) => c.key === x.criterio)?.nombre}: {x.valor}</strong> — {x.justificacion}</li>)}</ul>
                    <p className="mt-1 text-soft">Datos base: {e.datos_base}</p>
                  </td></tr>
                )}
              </Fragment>
            );
          })}</tbody>
        </table>
      </div>
      <p className="mt-1 text-xs text-soft">Haz clic en una fila para ver la justificación de cada puntaje. Puntaje = Σ (peso × puntaje 1–5). Clasificación ABC por % acumulado: A hasta el corte elegido, B hasta 95 %, C el resto.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl bg-[#fbfaf7] px-4 py-3 text-sm"><p className="mb-1 text-xs font-bold uppercase tracking-wide text-soft">Método</p><CiteText text={pa.metodo} refs={refs} /></div>
        <Bullets title="Limitaciones de la estimación" items={pa.limitaciones} tone="bg-amber-50" />
      </div>
    </div>
  );
}

function SaveWeights({ p, data, onDone }: { p: TdProps; data: () => Record<string, unknown>; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" disabled={busy} className="btn btn-primary !px-2.5 !py-1 text-xs" onClick={async () => {
      setBusy(true);
      const r = await fetch(`/api/strategy/${p.id}/td`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save", module: "pareto", data: data() }) });
      const j = await r.json().catch(() => ({}));
      setBusy(false);
      if (r.ok && j.result) { p.onResult?.(j.result); onDone(); } else alert(j.error || "No se pudo guardar");
    }}>Guardar ponderaciones</button>
  );
}

// =============== 3. Presupuesto ===============
export function BudgetTool(p: TdProps) {
  const b = p.result.plan.presupuesto, std = p.result.plan.std;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<TechBudget | undefined>(b);
  const [group, setGroup] = useState<"cat" | "std">("cat");
  const data = editing && draft ? draft : b;
  const t = useMemo(() => data && computeBudget(data), [data]);
  if (!b || !data || !t) return null;
  const cur = data.moneda;
  const set = (i: number, patch: Partial<BudgetLine>) => setDraft((d) => d && { ...d, partidas: d.partidas.map((x, j) => (j === i ? { ...x, ...patch, origen: patch.origen ?? "usuario" } : x)) });
  const add = () => setDraft((d) => d && { ...d, partidas: [...d.partidas, { id: `U${d.partidas.length + 1}`, std_id: std?.filas[0]?.id ?? "E1", concepto: "Nueva partida", categoria: "Otros", tipo: "inicial", periodicidad: "unica", cantidad: 1, unidad: "unidad", costo_unitario: 0, origen: "usuario", fuente_url: "", nota: "" }] });
  const dist = (group === "cat" ? t.porCategoria : t.porEstrategia).map((g) => ({ name: group === "std" ? `${g.key} · ${short(std?.filas.find((f) => f.id === g.key)?.std ?? "", 18)}` : g.key, Inicial: g.inicial, Recurrente: g.recurrente, total: g.total }));
  return (
    <div>
      <TdBar k="presupuesto" p={p} editing={editing} setEditing={(v) => { setDraft(clone(b)); setEditing(v); }} onSave={() => draft ?? null}
        exports={[{ label: "CSV", run: () => downloadCsv("presupuesto-std", [["ID", "S/TD", "Concepto", "Categoría", "Tipo", "Periodicidad", "Cantidad", "Unidad", `Costo unitario (${cur})`, `Costo anual (${cur})`, "Procedencia", "Fuente", "Nota"], ...b.partidas.map((x) => [x.id, x.std_id, x.concepto, x.categoria, x.tipo, x.periodicidad, x.cantidad, x.unidad, x.costo_unitario, lineAnnual(x), x.origen, x.fuente_url, x.nota])]) }]} />
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        <Tile i={0} label="Inversión inicial" value={money(t.inicial, cur)} hint="Pago único" />
        <Tile i={1} label="Costo recurrente anual" value={money(t.recurrenteAnual, cur)} hint="Operación y licencias" />
        <Tile i={2} label="Total año 1" value={money(t.anio1, cur)} tone="text-brand-dark" hint={`Horizonte ${data.horizonte_meses} meses: ${money(t.horizonte, cur)}`} />
        <div className="card p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-soft">Presupuesto disponible</p>
          {editing ? <Field type="number" value={draft?.disponible ?? ""} onChange={(v) => setDraft((d) => d && { ...d, disponible: v === "" ? null : Number(v) })} className="mt-1" />
            : <p className="display mt-1 text-2xl font-bold">{data.disponible == null ? <span className="text-base text-soft">No registrado</span> : money(data.disponible, cur)}</p>}
          {t.saldo != null && <p className={`mt-0.5 text-xs font-semibold ${t.saldo >= 0 ? "text-good" : "text-bad"}`}>{t.saldo >= 0 ? `Alcanza · saldo ${money(t.saldo, cur)}` : `Faltan ${money(-t.saldo, cur)}`}</p>}
          {data.disponible == null && !editing && <p className="mt-0.5 text-xs text-soft">Edita para registrarlo</p>}
        </div>
        <Tile i={4} label="Parte estimada" value={`${t.pctEstimado} %`} tone={t.pctEstimado > 50 ? "text-warn" : ""} hint="del año 1 no proviene de un precio verificable" />
      </div>
      {t.pctEstimado > 0 && <p className="mt-3 rounded-xl bg-amber-50 px-4 py-2.5 text-xs text-amber-800"><strong>Las estimaciones no son cotizaciones.</strong> Antes de aprobar el presupuesto, solicita cotizaciones a proveedores y reemplaza los costos unitarios marcados como estimación.</p>}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="card p-4">
          <div className="mb-2 flex items-center justify-between"><p className="font-semibold">Distribución presupuestal (año 1)</p>
            <Segmented id="bud" value={group} onChange={setGroup} options={[{ key: "cat", label: "Por categoría" }, { key: "std", label: "Por S/TD" }]} /></div>
          <div className="h-64"><ResponsiveContainer>
            <BarChart data={dist} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid stroke={C.grid} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: C.muted }} />
              <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11, fill: C.muted }} />
              <Tooltip formatter={(v) => money(Number(v), cur)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Inicial" stackId="a" fill={C.ink} isAnimationActive={false} />
              <Bar dataKey="Recurrente" stackId="a" fill={C.brand} radius={[0, 4, 4, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer></div>
        </div>
        <div className="card p-4">
          <p className="font-semibold">Participación por categoría</p>
          <div className="h-52"><ResponsiveContainer><PieChart>
            <Pie data={t.porCategoria.map((g) => ({ name: g.key, value: g.total }))} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2} isAnimationActive={false}>
              {t.porCategoria.map((g, i) => <Cell key={g.key} fill={PIE[i % PIE.length]} />)}
            </Pie><Tooltip formatter={(v) => money(Number(v), cur)} />
          </PieChart></ResponsiveContainer></div>
          <ul className="space-y-0.5 text-xs">{t.porCategoria.map((g, i) => <li key={g.key} className="flex justify-between gap-2"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: PIE[i % PIE.length] }} />{g.key}</span><span className="tabular-nums">{t.anio1 ? Math.round((g.total / t.anio1) * 100) : 0} %</span></li>)}</ul>
        </div>
      </div>

      <div className="mb-2 mt-5 flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Estructura de costos</h3><OrigenLegend counts={countOrigen(data.partidas)} /></div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[1050px] text-sm">
          <thead><tr className="border-b border-line"><Th>S/TD</Th><Th>Concepto</Th><Th>Categoría</Th><Th>Tipo</Th><Th className="text-right">Cant.</Th><Th className="text-right">Costo unit.</Th><Th className="text-right">Costo año 1</Th><Th>Procedencia</Th>{editing && <Th />}</tr></thead>
          <tbody>{data.partidas.map((x, i) => (
            <tr key={x.id + i} className="border-b border-line last:border-0 hover:bg-[#fbfaf7]">
              <Td>{editing ? <select className="input !px-1 !py-0.5 text-xs" value={x.std_id} onChange={(e) => set(i, { std_id: e.target.value })}>{(std?.filas ?? []).map((f) => <option key={f.id} value={f.id}>{f.id}</option>)}</select>
                : <span title={std?.filas.find((f) => f.id === x.std_id)?.std} className="rounded bg-ink px-1.5 py-0.5 text-[10px] font-bold text-white">{x.std_id}</span>}</Td>
              <Td>{editing ? <Field value={x.concepto} onChange={(v) => set(i, { concepto: v })} /> : <><p>{x.concepto}</p>{x.nota && <p className="text-xs text-soft">{x.nota}</p>}</>}</Td>
              <Td>{editing ? <select className="input !px-1 !py-0.5 text-xs" value={x.categoria} onChange={(e) => set(i, { categoria: e.target.value as BudgetLine["categoria"] })}>{BUDGET_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select> : x.categoria}</Td>
              <Td>{editing ? <select className="input !px-1 !py-0.5 text-xs" value={`${x.tipo}:${x.periodicidad}`} onChange={(e) => { const [tipo, per] = e.target.value.split(":"); set(i, { tipo: tipo as BudgetLine["tipo"], periodicidad: per as BudgetLine["periodicidad"] }); }}>
                  <option value="inicial:unica">Inicial (única)</option><option value="recurrente:mensual">Recurrente mensual</option><option value="recurrente:anual">Recurrente anual</option></select>
                : <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${x.tipo === "inicial" ? "bg-ink text-white" : "bg-[#eef7f5] text-brand-dark"}`}>{x.tipo === "inicial" ? "Inicial" : `Recurrente ${x.periodicidad}`}</span>}</Td>
              <Td className="text-right tabular-nums">{editing ? <Field type="number" className="!w-20 text-right" value={x.cantidad} onChange={(v) => set(i, { cantidad: Number(v) })} /> : <>{x.cantidad} <span className="text-xs text-soft">{x.unidad}</span></>}</Td>
              <Td className="text-right tabular-nums">{editing ? <Field type="number" className="!w-28 text-right" value={x.costo_unitario} onChange={(v) => set(i, { costo_unitario: Number(v) })} /> : money(x.costo_unitario, cur)}</Td>
              <Td className="text-right font-semibold tabular-nums">{money(lineAnnual(x), cur)}</Td>
              <Td>{editing
                ? <select className="input !px-1 !py-0.5 text-xs" value={x.origen} onChange={(e) => set(i, { origen: e.target.value as Origen })}><option value="usuario">Usuario</option><option value="estimacion">Estimación</option>{x.fuente_url && <option value="fuente">Fuente externa</option>}</select>
                : <span className="flex items-center gap-1"><OrigenBadge o={x.origen} />{x.fuente_url && <a href={x.fuente_url} target="_blank" rel="noreferrer noopener" className="text-xs text-brand hover:underline">fuente ↗</a>}</span>}</Td>
              {editing && <Td><button type="button" className="text-xs text-bad hover:underline" onClick={() => setDraft((d) => d && { ...d, partidas: d.partidas.filter((_, j) => j !== i) })}>Quitar</button></Td>}
            </tr>
          ))}</tbody>
          <tfoot><tr className="border-t-2 border-ink font-semibold"><Td>Total</Td><Td /><Td /><Td /><Td /><Td className="text-right text-xs text-soft">inicial {money(t.inicial, cur)}<br />recurrente {money(t.recurrenteAnual, cur)}</Td><Td className="text-right">{money(t.anio1, cur)}</Td><Td />{editing && <Td />}</tr></tfoot>
        </table>
      </div>
      {editing && <button type="button" onClick={add} className="btn btn-ghost mt-2 text-xs">+ Agregar partida</button>}
      <div className="mt-4 grid gap-3 md:grid-cols-2"><Bullets title="Supuestos" items={b.supuestos} /><Bullets title="Limitaciones" items={b.limitaciones} tone="bg-amber-50" /></div>
    </div>
  );
}

// =============== 4. KPI ===============
const NIVEL = { ok: { label: "Completo", cls: "bg-emerald-100 text-emerald-800" }, pendiente: { label: "Línea base pendiente", cls: "bg-amber-100 text-amber-800" }, revisar: { label: "Revisar", cls: "bg-red-100 text-bad" } };
export function KpiTool(p: TdProps) {
  const k = p.result.plan.kpis;
  const refs = useRefs(p.result);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(k);
  const [view, setView] = useState<"fichas" | "tabla">("fichas");
  if (!k) return null;
  const data = editing && draft ? draft : k;
  const cov = kpiCoverage(data, p.result.plan);
  const set = (i: number, patch: Partial<KpiCard>) => setDraft((d) => d && { ...d, indicadores: d.indicadores.map((x, j) => {
    if (j !== i) return x;
    const n = { ...x, ...patch, origen: "usuario" as Origen };
    if ("linea_base" in patch) n.linea_base_estado = patch.linea_base && !/pendiente/i.test(patch.linea_base) ? "disponible" : "pendiente";
    return n;
  }) });
  const cols: [keyof KpiCard, string][] = [["estrategia_id", "Estrategia"], ["objetivo", "Objetivo"], ["nombre", "Indicador"], ["tipo", "Tipo"], ["def_conceptual", "Definición conceptual"], ["def_operacional", "Definición operacional"], ["formula", "Fórmula"], ["unidad", "Unidad"], ["linea_base", "Línea base"], ["meta", "Meta"], ["fuente", "Fuente"], ["frecuencia", "Frecuencia"], ["responsable", "Responsable"]];
  return (
    <div>
      <TdBar k="kpis" p={p} editing={editing} setEditing={(v) => { setDraft(clone(k)); setEditing(v); }} onSave={() => draft ?? null}
        exports={[{ label: "CSV", run: () => downloadCsv("fichas-kpi", [cols.map(([, l]) => l).concat(["Procedencia"]), ...k.indicadores.map((x) => cols.map(([c]) => String(x[c] ?? "")).concat([x.origen]))]) }]} />
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        <Tile i={0} label="Indicadores" value={<CountUp value={cov.total} />} hint={`para ${planStrategies(p.result.plan).length} estrategias`} />
        <Tile i={1} label="Fichas completas" value={<CountUp value={cov.ok} />} tone="text-good" />
        <Tile i={2} label="Línea base pendiente" value={<CountUp value={cov.pendientes} />} tone={cov.pendientes ? "text-warn" : ""} />
        <Tile i={3} label="Por revisar" value={<CountUp value={cov.revisar} />} tone={cov.revisar ? "text-bad" : ""} />
        <Tile i={4} label="Estrategias sin KPI" value={cov.sinKpi.length ? cov.sinKpi.join(", ") : "Ninguna"} tone={cov.sinKpi.length ? "text-bad" : "text-good"} />
      </div>
      {data.datos_solicitados.length > 0 && <div className="mt-3"><Bullets title="Datos que la organización debe entregar para completar las líneas base" items={data.datos_solicitados} tone="bg-amber-50" /></div>}
      <div className="mb-3 mt-4 flex flex-wrap items-center justify-between gap-2">
        <Segmented id="kpi" value={view} onChange={setView} options={[{ key: "fichas", label: "Fichas técnicas" }, { key: "tabla", label: "Matriz de indicadores" }]} />
        <OrigenLegend counts={countOrigen(data.indicadores)} />
      </div>
      {view === "fichas" ? (
        <div className="grid gap-3 md:grid-cols-2">{data.indicadores.map((x, i) => {
          const ch = kpiChecks(x);
          return (
            <motion.div key={x.id} layout className="card p-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-ink px-1.5 py-0.5 text-[10px] font-bold text-white">{x.estrategia_id}</span>
                <span className="rounded bg-[#eef7f5] px-1.5 py-0.5 text-[10px] font-bold text-brand-dark">{x.tipo}</span>
                <h4 className="min-w-0 flex-1 font-semibold">{x.nombre}</h4>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${NIVEL[ch.nivel].cls}`}>{NIVEL[ch.nivel].label}</span>
                <OrigenBadge o={x.origen} />
              </div>
              <p className="mt-1 text-xs text-soft">{x.estrategia} · Objetivo: {x.objetivo}</p>
              <p className="mt-2 rounded-lg bg-[#fbfaf7] px-3 py-2 font-mono text-xs">{x.formula} <span className="font-sans text-soft">[{x.unidad}]</span></p>
              <dl className="mt-2 grid grid-cols-[7.5rem_1fr] gap-x-2 gap-y-1 text-xs">
                <dt className="font-semibold text-soft">Def. conceptual</dt><dd>{x.def_conceptual}</dd>
                <dt className="font-semibold text-soft">Def. operacional</dt><dd>{x.def_operacional}</dd>
                <dt className="font-semibold text-soft">Línea base</dt><dd>{editing ? <Field value={x.linea_base} onChange={(v) => set(i, { linea_base: v })} /> : <span className={x.linea_base_estado === "pendiente" ? "font-semibold text-warn" : ""}>{x.linea_base}</span>}</dd>
                <dt className="font-semibold text-soft">Meta</dt><dd>{editing ? <Field value={x.meta} onChange={(v) => set(i, { meta: v })} /> : <strong className="text-brand-dark">{x.meta}</strong>}</dd>
                <dt className="font-semibold text-soft">Fuente</dt><dd>{editing ? <Field value={x.fuente} onChange={(v) => set(i, { fuente: v })} /> : x.fuente}</dd>
                <dt className="font-semibold text-soft">Frecuencia</dt><dd>{editing ? <Field value={x.frecuencia} onChange={(v) => set(i, { frecuencia: v })} /> : x.frecuencia}</dd>
                <dt className="font-semibold text-soft">Responsable</dt><dd>{editing ? <Field value={x.responsable} onChange={(v) => set(i, { responsable: v })} /> : x.responsable}</dd>
                <dt className="font-semibold text-soft">Coherencia</dt><dd className="text-soft">{x.coherencia}</dd>
                <dt className="font-semibold text-soft">Por qué {x.tipo.toLowerCase()}</dt><dd className="text-soft"><CiteText text={x.justificacion_tipo} refs={refs} /></dd>
              </dl>
              {ch.notas.length > 0 && <ul className="mt-2 space-y-0.5 text-[11px] text-warn">{ch.notas.map((n, j) => <li key={j}>⚠ {n}</li>)}</ul>}
            </motion.div>
          );
        })}</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[1600px] text-xs">
            <thead><tr className="border-b border-line">{cols.map(([c, l]) => <Th key={c}>{l}</Th>)}<Th>Proc.</Th></tr></thead>
            <tbody>{data.indicadores.map((x) => <tr key={x.id} className="border-b border-line last:border-0">{cols.map(([c]) => <Td key={c} className={c === "formula" ? "font-mono" : c === "linea_base" && x.linea_base_estado === "pendiente" ? "font-semibold text-warn" : ""}>{String(x[c] ?? "")}</Td>)}<Td><OrigenBadge o={x.origen} /></Td></tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// =============== 5. Investigación ===============
export function SciRef({ r }: { r: ScientificRef }) {
  const x = sciParts(r);
  return (
    <span>{x.lead} <em>{x.revista}</em>{x.vol && <>, <em>{x.vol}</em></>}{x.rest}{x.link && <> <a href={x.link} target="_blank" rel="noreferrer noopener" className="break-all text-brand hover:underline">{x.link}</a></>}</span>
  );
}

export function ResearchTool(p: TdProps) {
  const l = p.result.plan.literatura, o = p.result.plan.operacionalizacion;
  const [area, setArea] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(l);
  const year = new Date().getFullYear();
  if (!l || !o) return null;
  const data = editing && draft ? draft : l;
  const st = literatureStats(data, year);
  const list = data.referencias.filter((r) => !area || r.area === area);
  const cite = (ids: string[]) => ids.map((id) => data.referencias.find((r) => r.id === id)).filter((r): r is ScientificRef => !!r);
  const sorted = [...data.referencias].sort((a, b) => a.autores.localeCompare(b.autores, "es") || a.anio - b.anio);
  return (
    <div>
      <TdBar k="investigacion" p={p} editing={editing} setEditing={(v) => { setDraft(clone(l)); setEditing(v); }} onSave={() => (draft ? { literatura: draft } : null)}
        exports={[
          { label: "Matriz CSV", run: () => downloadCsv("operacionalizacion", [["Variable", "Tipo", "Definición conceptual", "Definición operacional", "Dimensión", "Indicadores", "Sustento"], ...o.variables.flatMap((v) => v.dimensiones.map((d) => [v.nombre, v.tipo, v.def_conceptual, v.def_operacional, d.nombre, d.indicadores.join("; "), cite(d.refs).map(sciCite).join("; ")]))]) },
          { label: "Referencias CSV", run: () => downloadCsv("referencias", [["ID", "Área", "Estado", "Autores", "Año", "Título", "Revista", "Volumen", "Número", "Páginas", "DOI", "URL", "Bases"], ...l.referencias.map((r) => [r.id, AREAS[r.area], r.estado, r.autores, r.anio, r.titulo, r.revista, r.volumen, r.numero, r.paginas, r.doi, r.url, r.bases.join(", ")])]) },
        ]} />
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Tile i={0} label="Referencias" value={<CountUp value={st.total} />} hint={st.cumpleMinimo ? "≥ 3 por área · ≥ 12 en total" : "No alcanza 3 por área"} tone={st.cumpleMinimo ? "text-good" : "text-warn"} />
        <Tile i={1} label="Consultadas" value={<CountUp value={st.consultadas} />} hint={`${st.total - st.consultadas} sugeridas por verificar`} />
        <Tile i={2} label={`Desde ${st.desde}`} value={<CountUp value={st.recientes} />} hint="últimos cuatro años" />
        <Tile i={3} label="Con DOI" value={<CountUp value={st.conDoi} />} />
      </div>
      <p className="mt-3 rounded-xl bg-[#fbfaf7] px-4 py-2.5 text-xs text-soft"><strong className="text-ink">Consultada</strong>: el agente abrió la página del artículo y tomó sus datos. <strong className="text-ink">Sugerida</strong>: debe verificarse en la base indexada antes de citarla. El sistema no genera DOI ni datos de indexación: los que no se vieron quedan vacíos.{l.nota && <> {l.nota}</>}</p>

      <div className="mt-4 grid gap-2 sm:grid-cols-4">{st.byArea.map((a) => (
        <button key={a.area} type="button" onClick={() => setArea(area === a.area ? 0 : a.area)} className={`card p-3 text-left ${area === a.area ? "!border-ink ring-1 ring-ink" : ""} ${area && area !== a.area ? "opacity-50" : ""}`}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-soft">Área {a.area}</p>
          <p className="text-xs font-semibold leading-snug">{a.nombre}</p>
          <div className="mt-2 flex items-end gap-1">{[0, 1, 2].map((n) => <span key={n} className={`h-2 flex-1 rounded-full ${n < a.total ? "bg-brand" : "bg-[#ece9e0]"}`} />)}<span className="ml-1 text-sm font-bold tabular-nums">{a.total}</span></div>
          <p className="mt-1 text-[10px] text-soft">{a.consultadas} consultadas · {a.recientes} recientes</p>
        </button>
      ))}</div>

      <h3 className="mb-2 mt-5 font-semibold">Literatura {area ? `· ${AREAS[area]}` : "por área"}</h3>
      <ol className="space-y-2">{list.map((r) => (
        <li key={r.id} className="card p-3 text-sm">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span className="rounded bg-ink px-1.5 py-0.5 text-[10px] font-bold text-white">{r.id}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${r.estado === "consultada" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{r.estado === "consultada" ? "Consultada" : "Sugerida · verificar"}</span>
            {r.anio < st.desde && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-bad">Anterior a {st.desde}</span>}
            {r.bases.map((b) => <span key={b} className="rounded-full border border-line px-2 py-0.5 text-[10px] font-semibold text-soft">{b}</span>)}
            <span className="text-[10px] text-soft">Área {r.area}</span>
            {editing && <span className="ml-auto flex gap-2">
              <button type="button" className="text-xs font-semibold text-brand hover:underline" onClick={() => setDraft((d) => d && { ...d, referencias: d.referencias.map((x) => x.id === r.id ? { ...x, estado: x.estado === "consultada" ? "sugerida" : "consultada" } : x) })}>{r.estado === "consultada" ? "Marcar sugerida" : "Marcar verificada"}</button>
              <button type="button" className="text-xs text-bad hover:underline" onClick={() => setDraft((d) => d && { ...d, referencias: d.referencias.filter((x) => x.id !== r.id) })}>Quitar</button>
            </span>}
          </div>
          <p className="pl-6 -indent-6"><SciRef r={r} /></p>
          {r.aporte && <p className="mt-1 text-xs text-soft">Aporte: {r.aporte}</p>}
        </li>
      ))}</ol>

      <h3 className="mb-1 mt-6 font-semibold">Matriz de operacionalización de variables</h3>
      <p className="mb-2 text-sm text-soft">{o.problema}</p>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[1100px] text-xs">
          <thead><tr className="border-b border-line"><Th>Variable</Th><Th>Definición conceptual</Th><Th>Definición operacional</Th><Th>Dimensiones</Th><Th>Indicadores</Th><Th>Sustento bibliográfico</Th></tr></thead>
          <tbody>{o.variables.map((v) => v.dimensiones.map((d, j) => (
            <tr key={v.nombre + j} className="border-b border-line last:border-0">
              {j === 0 && <>
                <td rowSpan={v.dimensiones.length} className="border-r border-line px-3 py-2 align-top font-semibold">{v.nombre}<br /><span className="font-normal text-soft">({v.tipo})</span></td>
                <td rowSpan={v.dimensiones.length} className="border-r border-line px-3 py-2 align-top">{v.def_conceptual} {cite(v.refs_conceptual).length > 0 && <span className="text-brand">({cite(v.refs_conceptual).map(sciCite).join("; ")})</span>}</td>
                <td rowSpan={v.dimensiones.length} className="border-r border-line px-3 py-2 align-top">{v.def_operacional}</td>
              </>}
              <Td className="font-semibold">{d.nombre}</Td>
              <Td><ul className="list-disc pl-4">{d.indicadores.map((x, k) => <li key={k}>{x}</li>)}</ul></Td>
              <Td>{cite(d.refs).length ? cite(d.refs).map((r) => <span key={r.id} title={r.titulo} className="mr-1 inline-block text-brand">({sciCite(r)})</span>) : <span className="font-semibold text-bad">Sin sustento</span>}</Td>
            </tr>
          )))}</tbody>
        </table>
      </div>

      <h3 className="mb-2 mt-6 font-semibold">Referencias (APA 7)</h3>
      <ol className="card space-y-1.5 p-5 text-sm">{sorted.map((r) => <li key={r.id} className="pl-8 -indent-8"><SciRef r={r} />{r.estado === "sugerida" && <span className="ml-1 text-[10px] font-bold text-warn">[por verificar]</span>}</li>)}</ol>
    </div>
  );
}

// =============== 6. Brechas ===============
export function GapsTool(p: TdProps & { docsSlot?: ReactNode }) {
  const g = p.result.plan.brechas;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(g);
  const [eje, setEje] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  if (!g) return null;
  const data = editing && draft ? draft : g;
  const ix = gapIndex(data);
  const set = (i: number, patch: Partial<GapRow>) => setDraft((d) => d && { ...d, filas: d.filas.map((f, j) => (j === i ? { ...f, ...patch, origen: "usuario" as Origen } : f)) });
  const rows = data.filas.filter((f) => !eje || f.eje === eje);
  return (
    <div>
      <TdBar k="brechas" p={p} editing={editing} setEditing={(v) => { setDraft(clone(g)); setEditing(v); }} onSave={() => draft ?? null}
        exports={[{ label: "CSV", run: () => downloadCsv("matriz-alineamiento", [["ID", "Eje", "Lineamiento de la política", "Objetivo/acción institucional", "Situación actual", "Evidencia documental", "Fuente de la evidencia", "Nivel (0-3)", "Correspondencia", "Brecha", "Necesidad institucional", "Posible problema de investigación", "Procedencia"], ...g.filas.map((f) => [f.id, f.eje, f.lineamiento, f.objetivo_institucional, f.situacion_actual, f.evidencia, f.evidencia_fuente, f.nivel, ALIGN_LABEL[f.nivel], f.brecha, f.necesidad, f.problema, f.origen])]) }]} />
      <div className="grid gap-3 lg:grid-cols-[16rem_1fr]">
        <div className="card flex flex-col items-center justify-center p-4">
          <Gauge value={ix.indice} min={0} max={100} mark={50} tone={ix.indice >= 67 ? "var(--good)" : ix.indice >= 34 ? "var(--warn)" : "var(--bad)"}
            label={<><p className="display text-3xl font-bold"><CountUp value={ix.indice} />%</p><p className="text-xs text-soft">Índice de alineamiento</p></>} />
          <p className="mt-2 text-center text-xs text-soft">{data.documento_institucional}<br />frente a <strong className="text-ink">{data.documento_referencia}</strong></p>
        </div>
        <div className="card p-4">
          <p className="mb-1 font-semibold">Alineamiento por eje</p>
          <div className="h-56"><ResponsiveContainer>
            <BarChart data={ix.ejes} layout="vertical" margin={{ left: 8, right: 16 }} onClick={(e) => { const v = (e as unknown as { activeLabel?: string } | null)?.activeLabel; if (v) setEje(eje === v ? null : v); }}>
              <CartesianGrid stroke={C.grid} horizontal={false} />
              <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: C.muted }} />
              <YAxis type="category" dataKey="eje" width={140} tick={{ fontSize: 11, fill: C.muted }} />
              <Tooltip formatter={(v) => `${v} %`} />
              <Bar dataKey="indice" name="Alineamiento" radius={[0, 4, 4, 0]} isAnimationActive={false} cursor="pointer">
                {ix.ejes.map((e) => <Cell key={e.eje} fill={eje && eje !== e.eje ? "#d9d6cc" : e.indice >= 67 ? C.brand : e.indice >= 34 ? C.b : "#c8412f"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer></div>
          <div className="mt-1 flex flex-wrap gap-2 text-xs">{ix.niveles.map((n) => <span key={n.nivel} className={`rounded-full px-2 py-0.5 font-semibold ${ALIGN_CLS[n.nivel]}`}>{n.label}: {n.total}</span>)}{eje && <button type="button" className="font-semibold text-brand hover:underline" onClick={() => setEje(null)}>Ver todos los ejes</button>}</div>
        </div>
      </div>

      <div className="mb-2 mt-5 flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Matriz de alineamiento{eje ? ` · ${eje}` : ""}</h3><OrigenLegend counts={countOrigen(data.filas)} /></div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[1250px] text-xs">
          <thead><tr className="border-b border-line"><Th>ID</Th><Th>Lineamiento de la política</Th><Th>Objetivo o acción institucional</Th><Th>Situación actual</Th><Th>Evidencia documental</Th><Th>Nivel</Th><Th>Brecha</Th><Th>Necesidad</Th><Th>Posible problema</Th></tr></thead>
          <tbody>{rows.map((f) => { const i = data.filas.indexOf(f); return (
            <tr key={f.id} className="border-b border-line last:border-0 hover:bg-[#fbfaf7]">
              <Td className="font-bold">{f.id}<br /><OrigenBadge o={f.origen} /></Td>
              <Td><p className="text-[10px] font-bold uppercase text-soft">{f.eje}</p>{f.lineamiento}</Td>
              <Td>{f.objetivo_institucional}</Td>
              <Td>{f.situacion_actual}</Td>
              <Td><button type="button" className="text-left" onClick={() => setOpen(open === f.id ? null : f.id)}>{f.evidencia && !/^sin evidencia/i.test(f.evidencia) ? <><span className={open === f.id ? "" : "line-clamp-3"}>“{f.evidencia.replace(/^["“'«\s]+|["”'»\s]+$/g, "")}”</span><span className="mt-0.5 block text-[10px] text-soft">{f.evidencia_fuente}</span></> : <span className="font-semibold text-bad">Sin evidencia</span>}</button></Td>
              <Td>{editing
                ? <select className="input !px-1 !py-0.5 text-xs" value={f.nivel} onChange={(e) => set(i, { nivel: Number(e.target.value) as AlignLevel })}>{([0, 1, 2, 3] as const).map((n) => <option key={n} value={n}>{n} · {ALIGN_LABEL[n]}</option>)}</select>
                : <span className={`inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-bold ${ALIGN_CLS[f.nivel]}`}>{f.nivel} · {ALIGN_LABEL[f.nivel]}</span>}</Td>
              <Td>{editing ? <Field area value={f.brecha} onChange={(v) => set(i, { brecha: v })} /> : f.brecha}</Td>
              <Td>{editing ? <Field area value={f.necesidad} onChange={(v) => set(i, { necesidad: v })} /> : f.necesidad}</Td>
              <Td className="text-soft">{f.problema}</Td>
            </tr>
          ); })}</tbody>
        </table>
      </div>

      <h3 className="mb-2 mt-6 font-semibold">Problemas de investigación</h3>
      <div className="grid gap-3 md:grid-cols-2">{data.problemas.map((q) => (
        <div key={q.id} className={`card p-4 ${q.tipo === "general" ? "md:col-span-2 !border-brand" : ""}`}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-brand-dark">{q.tipo === "general" ? "Problema general" : "Problema específico"}</p>
          <p className="mt-1 font-semibold">{q.enunciado}</p>
          <p className="mt-1 text-xs text-soft">{q.evidencia}</p>
          <div className="mt-2 flex flex-wrap gap-1">{q.lineamientos.map((id) => { const f = data.filas.find((x) => x.id === id); return f && <span key={id} title={f.lineamiento} className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${ALIGN_CLS[f.nivel]}`}>{id}</span>; })}</div>
        </div>
      ))}</div>
      <div className="mt-4"><Bullets title="Limitaciones del diagnóstico" items={g.limitaciones} tone="bg-amber-50" /></div>
      {p.docsSlot}
    </div>
  );
}

// =============== 7. Estrategias de TD ===============
const EXIG = { baja: "bg-emerald-100 text-emerald-800", media: "bg-amber-100 text-amber-800", alta: "bg-red-100 text-bad" };
export function DigitalTool(p: TdProps) {
  const d = p.result.plan.estrategias_td, g = p.result.plan.brechas;
  const refs = useRefs(p.result);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(d);
  if (!d) return null;
  const data = editing && draft ? draft : d;
  const set = (i: number, patch: Partial<DigitalProposal>) => setDraft((x) => x && { ...x, propuestas: x.propuestas.map((y, j) => (j === i ? { ...y, ...patch, origen: "usuario" as Origen } : y)) });
  const yes = data.propuestas.filter((x) => x.aplica), no = data.propuestas.filter((x) => !x.aplica);
  const ejeOf = (x: DigitalProposal) => g?.filas.find((f) => f.id === x.lineamiento_id)?.eje ?? "General";
  const nivelOf = (x: DigitalProposal) => g?.filas.find((f) => f.id === x.lineamiento_id)?.nivel;
  return (
    <div>
      <TdBar k="estrategias_td" p={p} editing={editing} setEditing={(v) => { setDraft(clone(d)); setEditing(v); }} onSave={() => draft ?? null}
        exports={[{ label: "CSV", run: () => downloadCsv("estrategias-td", [["ID", "Lineamiento", "Aplica", "Motivo si no aplica", "Necesidad", "Brecha", "Estrategia", "S/TD sugerida", "Justificación", "Beneficio", "Indicador", "Exigencia", "Horizonte", "Procedencia"], ...d.propuestas.map((x) => [x.id, `${x.lineamiento_id} ${x.lineamiento}`, x.aplica ? "Sí" : "No", x.motivo_no_aplica, x.necesidad, x.brecha, x.estrategia, x.std, x.justificacion, x.beneficio, x.indicador, x.exigencia, x.horizonte, x.origen])]) }]} />
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Tile i={0} label="Propuestas" value={<CountUp value={yes.length} />} hint="con solución tecnológica" />
        <Tile i={1} label="Sin solución propia" value={<CountUp value={no.length} />} hint="justificadas" />
        <Tile i={2} label="Exigencia alta" value={<CountUp value={yes.filter((x) => x.exigencia === "alta").length} />} tone="text-bad" />
        <Tile i={3} label="Lineamientos con brecha" value={<CountUp value={g?.filas.filter((f) => f.nivel < 3).length ?? 0} />} hint={g ? `de ${g.filas.length}` : ""} />
      </div>
      <div className="mt-4 space-y-4">{[...new Set(yes.map(ejeOf))].map((e) => (
        <div key={e}>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-soft">{e}</p>
          <div className="grid gap-3 md:grid-cols-2">{yes.filter((x) => ejeOf(x) === e).map((x) => { const i = data.propuestas.indexOf(x); const n = nivelOf(x); return (
            <motion.div key={x.id} layout className="card p-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${n != null ? ALIGN_CLS[n] : "bg-ink text-white"}`}>{x.lineamiento_id}</span>
                <p className="min-w-0 flex-1 text-xs text-soft">{x.lineamiento}</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${EXIG[x.exigencia]}`}>exigencia {x.exigencia}</span>
                <OrigenBadge o={x.origen} />
              </div>
              {editing ? <div className="mt-2 space-y-1"><Field value={x.estrategia} onChange={(v) => set(i, { estrategia: v })} /><Field value={x.std} onChange={(v) => set(i, { std: v })} /><Field value={x.indicador} onChange={(v) => set(i, { indicador: v })} />
                <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={x.aplica} onChange={(ev) => set(i, { aplica: ev.target.checked, motivo_no_aplica: ev.target.checked ? "" : "Descartado por el usuario" })} />Requiere solución tecnológica</label></div>
                : <><h4 className="mt-2 font-semibold">{x.estrategia}</h4><p className="mt-1 text-sm"><span className="rounded bg-[#eef7f5] px-1.5 py-0.5 text-xs font-semibold text-brand-dark">S/TD</span> {x.std}</p></>}
              <dl className="mt-2 grid grid-cols-[6.5rem_1fr] gap-x-2 gap-y-1 text-xs">
                <dt className="font-semibold text-soft">Necesidad</dt><dd>{x.necesidad}</dd>
                <dt className="font-semibold text-soft">Brecha</dt><dd>{x.brecha}</dd>
                <dt className="font-semibold text-soft">Justificación</dt><dd><CiteText text={x.justificacion} refs={refs} /></dd>
                <dt className="font-semibold text-soft">Beneficio</dt><dd>{x.beneficio}</dd>
                <dt className="font-semibold text-soft">Indicador</dt><dd className="font-mono">{x.indicador}</dd>
                <dt className="font-semibold text-soft">Horizonte</dt><dd>{x.horizonte}</dd>
              </dl>
            </motion.div>
          ); })}</div>
        </div>
      ))}</div>
      {no.length > 0 && (
        <div className="card mt-4 p-4">
          <p className="mb-2 font-semibold">Lineamientos que no requieren una solución tecnológica independiente</p>
          <ul className="space-y-1 text-sm">{no.map((x) => <li key={x.id}><strong>{x.lineamiento_id}</strong> {x.lineamiento} — <span className="text-soft">{x.motivo_no_aplica}</span>{editing && <button type="button" className="ml-2 text-xs font-semibold text-brand hover:underline" onClick={() => set(data.propuestas.indexOf(x), { aplica: true, motivo_no_aplica: "" })}>Reactivar</button>}</li>)}</ul>
        </div>
      )}
      <CiteText text={d.conclusion} refs={refs} className="mt-4 rounded-xl bg-[#eef7f5] px-4 py-3 text-sm leading-relaxed" />
    </div>
  );
}
