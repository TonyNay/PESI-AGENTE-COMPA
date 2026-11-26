"use client";
import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode } from "react";
import type { AnsoffKey, BcgQuadrant, CanvasBlock, Level, MatrixFactor, PestelDimension, StrategicPlan, StrategicResult, StrategyItem } from "@/lib/types";
import { CiteText, useRefs } from "./cite";
import { CountUp, Gauge, Segmented, Stagger, item, pop } from "./motion-kit";

export type ToolProps = { result: StrategicResult; subject: string };

export const PESTEL: { key: PestelDimension; label: string; letter: string }[] = [
  { key: "politico", label: "Político", letter: "P" }, { key: "economico", label: "Económico", letter: "E" }, { key: "social", label: "Social", letter: "S" },
  { key: "tecnologico", label: "Tecnológico", letter: "T" }, { key: "ecologico", label: "Ecológico", letter: "E" }, { key: "legal", label: "Legal", letter: "L" },
];
const FORCES: { key: "rivalidad" | "nuevos_entrantes" | "sustitutos" | "poder_proveedores" | "poder_clientes"; label: string; short: string }[] = [
  { key: "nuevos_entrantes", label: "Amenaza de nuevos entrantes", short: "Nuevos entrantes" },
  { key: "poder_proveedores", label: "Poder de negociación de proveedores", short: "Proveedores" },
  { key: "rivalidad", label: "Rivalidad entre competidores", short: "Rivalidad" },
  { key: "poder_clientes", label: "Poder de negociación de clientes", short: "Clientes" },
  { key: "sustitutos", label: "Amenaza de sustitutos", short: "Sustitutos" },
];
const QUADRANTS: { key: StrategyItem["tipo"]; label: string; hint: string; cls: string }[] = [
  { key: "FO", label: "FO · Ofensivas", hint: "Fortalezas para aprovechar oportunidades", cls: "bg-emerald-600" },
  { key: "DO", label: "DO · Reorientación", hint: "Superar debilidades con oportunidades", cls: "bg-sky-600" },
  { key: "FA", label: "FA · Defensivas", hint: "Fortalezas para reducir amenazas", cls: "bg-amber-600" },
  { key: "DA", label: "DA · Supervivencia", hint: "Reducir debilidades y evitar amenazas", cls: "bg-red-600" },
];
const CANVAS: { key: CanvasBlock; label: string; cls: string }[] = [
  { key: "socios_clave", label: "Socios clave", cls: "md:col-start-1 md:row-start-1 md:row-span-2" },
  { key: "actividades_clave", label: "Actividades clave", cls: "md:col-start-2 md:row-start-1" },
  { key: "recursos_clave", label: "Recursos clave", cls: "md:col-start-2 md:row-start-2" },
  { key: "propuesta_valor", label: "Propuesta de valor", cls: "md:col-start-3 md:row-start-1 md:row-span-2 !bg-[#eef7f5]" },
  { key: "relacion_clientes", label: "Relación con clientes", cls: "md:col-start-4 md:row-start-1" },
  { key: "canales", label: "Canales", cls: "md:col-start-4 md:row-start-2" },
  { key: "segmentos_clientes", label: "Segmentos de clientes", cls: "md:col-start-5 md:row-start-1 md:row-span-2" },
  { key: "estructura_costos", label: "Estructura de costos", cls: "md:col-start-1 md:col-span-2 md:row-start-3" },
  { key: "fuentes_ingreso", label: "Fuentes de ingreso", cls: "md:col-start-3 md:col-span-3 md:row-start-3" },
];
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"];

function LevelBadge({ l, prefix = "" }: { l: Level; prefix?: string }) {
  const cls = l === "alta" ? "bg-red-50 text-bad" : l === "media" ? "bg-amber-50 text-warn" : "bg-slate-100 text-soft";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{prefix}{l}</span>;
}

function Note({ children }: { children: ReactNode }) {
  return <motion.div variants={item} initial="hidden" animate="show" className="mt-4 rounded-xl bg-[#eef7f5] px-4 py-3 text-sm leading-relaxed">{children}</motion.div>;
}

// ---------------- Resumen ----------------
export function SummaryTool({ result }: ToolProps) {
  const { research: r, plan: p } = result;
  const refs = useRefs(result);
  return (
    <Stagger className="space-y-4">
      {p.resumen_ejecutivo && (
        <motion.section variants={item} className="card relative overflow-hidden p-6">
          <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-brand to-accent" />
          <p className="eyebrow">Resumen ejecutivo</p>
          <CiteText text={p.resumen_ejecutivo} refs={refs} className="mt-2 text-[1.05rem] leading-relaxed" />
        </motion.section>
      )}
      <motion.div variants={item} className="grid gap-4 md:grid-cols-2">
        {([["Qué hace", r.perfil.descripcion], ["Propuesta de valor", r.perfil.propuesta_valor], ["Clientes objetivo", r.perfil.clientes_objetivo], ["Presencia digital", r.perfil.presencia_digital]] as const).map(([k, v]) => (
          <div key={k} className="card p-5"><p className="label">{k}</p><p className="text-sm leading-relaxed">{v}</p></div>
        ))}
      </motion.div>
      {r.perfil.productos_servicios.length > 0 && (
        <motion.div variants={item} className="card p-5">
          <p className="label">Productos y servicios</p>
          <Stagger className="mt-1 flex flex-wrap gap-2" gap={0.03}>
            {r.perfil.productos_servicios.map((t) => <motion.span key={t} variants={pop} className="rounded-full border border-line bg-[#fbfaf7] px-3 py-1 text-sm">{t}</motion.span>)}
          </Stagger>
        </motion.div>
      )}
      {r.hallazgos_documento.length > 0 && (
        <motion.div variants={item} className="card p-5">
          <p className="label">Hallazgos del documento</p>
          <ul className="mt-1 grid gap-2 text-sm md:grid-cols-2">{r.hallazgos_documento.map((h, i) => <li key={i} className="rounded-lg bg-[#fbfaf7] px-3 py-2">{h}</li>)}</ul>
        </motion.div>
      )}
    </Stagger>
  );
}

// ---------------- Identidad ----------------
export function IdentityTool({ result }: ToolProps) {
  const { research: r, plan: p } = result;
  const refs = useRefs(result);
  const [show, setShow] = useState<"propuesta" | "declarada">("propuesta");
  const hasDeclared = !!(r.perfil.mision_declarada || r.perfil.vision_declarada);
  if (!p.mision || !p.vision) return null;
  return (
    <div>
      {hasDeclared && <div className="mb-4"><Segmented id="ident" value={show} onChange={setShow} options={[{ key: "propuesta", label: "Propuesta del agente" }, { key: "declarada", label: "Declarada por la empresa" }]} /></div>}
      <div className="grid gap-4 md:grid-cols-2">
        {([["Misión", p.mision, r.perfil.mision_declarada, "Qué hace, para quién y cómo"], ["Visión", p.vision, r.perfil.vision_declarada, "A dónde quiere llegar"]] as const).map(([label, v, declared, hint], i) => (
          <motion.div key={label} className="card relative overflow-hidden p-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.12, type: "spring", stiffness: 200, damping: 22 }}>
            <span className="display pointer-events-none absolute -right-2 -top-8 select-none text-[9rem] leading-none text-brand/10">“</span>
            <p className="eyebrow">{label}</p>
            <p className="text-xs text-soft">{hint}</p>
            <AnimatePresence mode="wait">
              <motion.p key={show} className="display mt-3 text-xl font-semibold leading-snug" initial={{ opacity: 0, filter: "blur(4px)" }} animate={{ opacity: 1, filter: "blur(0px)" }} exit={{ opacity: 0 }}>
                {show === "propuesta" ? v.texto : declared || "La empresa no publica una declaración."}
              </motion.p>
            </AnimatePresence>
            {show === "propuesta" && <CiteText text={v.justificacion} refs={refs} className="mt-3 text-sm text-soft" />}
          </motion.div>
        ))}
      </div>
      {!!p.valores?.length && (
        <div className="mt-5">
          <p className="label">Valores</p>
          <Stagger className="flex flex-wrap gap-2" gap={0.07} delay={0.3}>
            {p.valores.map((v) => (
              <motion.span key={v} variants={pop} whileHover={{ y: -3 }} className="rounded-xl border border-brand/30 bg-white px-4 py-2 text-sm font-semibold text-brand-dark shadow-sm">{v}</motion.span>
            ))}
          </Stagger>
        </div>
      )}
    </div>
  );
}

// ---------------- Canvas ----------------
export function CanvasTool({ result }: ToolProps) {
  const c = result.plan.canvas;
  const [focus, setFocus] = useState<CanvasBlock | null>(null);
  if (!c) return null;
  return (
    <>
      <p className="mb-3 text-xs text-soft">Toca un bloque para enfocarlo.</p>
      <Stagger className="grid gap-2 md:grid-cols-5 md:grid-rows-[auto_auto_auto]" gap={0.04}>
        {CANVAS.map((b) => (
          <motion.button type="button" key={b.key} variants={item} onClick={() => setFocus(focus === b.key ? null : b.key)}
            animate={{ opacity: focus && focus !== b.key ? 0.35 : 1, scale: focus === b.key ? 1.02 : 1 }}
            whileHover={{ y: -2 }}
            className={`card p-3 text-left ${b.cls} ${focus === b.key ? "ring-2 ring-brand" : ""}`}>
            <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-brand-dark">{b.label}</h3>
            <ul className="list-disc space-y-0.5 pl-4 text-sm">{(c[b.key] ?? []).map((t, i) => <li key={i}>{t}</li>)}</ul>
          </motion.button>
        ))}
      </Stagger>
    </>
  );
}

// ---------------- Cadena de valor ----------------
const EVAL_CLS = { ventaja: "bg-emerald-500 text-white", paridad: "bg-slate-300 text-ink", "a mejorar": "bg-red-500 text-white" } as const;
export function ValueChainTool({ result }: ToolProps) {
  const cv = result.plan.cadena_valor;
  const refs = useRefs(result);
  const [sel, setSel] = useState<number | null>(null);
  const [view, setView] = useState<"cadena" | "procesos">("cadena");
  if (!cv) return null;
  const support = cv.map((a, i) => ({ ...a, i })).filter((a) => a.tipo === "apoyo");
  const primary = cv.map((a, i) => ({ ...a, i })).filter((a) => a.tipo === "primaria");
  const count = (e: string) => cv.filter((a) => a.evaluacion === e).length;
  const hasProcs = cv.some((a) => a.procesos?.length);
  const totalProcs = cv.reduce((n, a) => n + (a.procesos?.length ?? 0), 0);
  const s = sel != null ? cv[sel] : null;
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          {(["ventaja", "paridad", "a mejorar"] as const).map((e) => (
            <div key={e} className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2">
              <span className={`h-3 w-3 rounded-full ${EVAL_CLS[e].split(" ")[0]}`} />
              <span className="text-sm capitalize">{e}</span>
              <span className="display text-lg font-bold"><CountUp value={count(e)} /></span>
            </div>
          ))}
        </div>
        {hasProcs && <Segmented id="cadena" value={view} onChange={setView} options={[{ key: "cadena", label: "Cadena de valor" }, { key: "procesos", label: `Procesos (${totalProcs})` }]} />}
      </div>
      {!hasProcs && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-warn">Este reporte se generó antes de incluir los procesos principales por actividad. Crea un nuevo análisis para obtenerlos.</p>}
      {view === "procesos" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[...primary, ...support].map((a) => (
            <motion.div key={a.i} className="card p-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: a.i * 0.03 }}>
              <div className="flex items-start justify-between gap-2">
                <div><h3 className="font-semibold leading-tight">{a.actividad}</h3><p className="text-[10px] font-semibold uppercase text-soft">Actividad {a.tipo === "primaria" ? "primaria" : "de apoyo"}</p></div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${EVAL_CLS[a.evaluacion]}`}>{a.evaluacion}</span>
              </div>
              <ol className="mt-2 space-y-1 text-sm">{(a.procesos ?? []).map((pr, j) => (
                <li key={j} className="flex gap-2"><span className="w-5 shrink-0 text-right font-bold tabular-nums text-brand">{j + 1}.</span>{pr}</li>
              ))}</ol>
            </motion.div>
          ))}
        </div>
      ) : <>
      <div className="card overflow-x-auto p-4">
        <div className="flex min-w-[640px] gap-1.5">
          <div className="min-w-0 flex-1">
          <Stagger className="space-y-1.5" gap={0.05}>
            {support.map((a) => (
              <motion.button type="button" key={a.i} variants={item} onClick={() => setSel(a.i)} whileHover={{ x: 4 }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold ${EVAL_CLS[a.evaluacion]} ${sel === a.i ? "ring-2 ring-ink ring-offset-2" : ""}`}>
                {a.actividad}<span className="text-xs font-medium opacity-80">{a.procesos?.length ? `${a.procesos.length} procesos · ` : ""}{a.evaluacion}</span>
              </motion.button>
            ))}
          </Stagger>
          <Stagger className="mt-2 grid gap-1" gap={0.07} delay={0.2}>
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.max(1, primary.length)}, minmax(0, 1fr))` }}>
              {primary.map((a) => (
                <motion.button type="button" key={a.i} variants={item} onClick={() => setSel(a.i)} whileHover={{ y: -4 }}
                  style={{ clipPath: "polygon(0 0, 88% 0, 100% 50%, 88% 100%, 0 100%, 12% 50%)" }}
                  className={`flex min-h-24 flex-col items-center justify-center px-6 py-3 text-center text-xs font-bold ${EVAL_CLS[a.evaluacion]} ${sel === a.i ? "brightness-90" : ""}`}>
                  {a.actividad}
                  {!!a.procesos?.length && <span className="mt-1 text-[10px] font-medium opacity-80">{a.procesos.length} procesos</span>}
                </motion.button>
              ))}
            </div>
          </Stagger>
          </div>
          <div className="flex w-12 shrink-0 items-center justify-center rounded-r-2xl bg-ink text-[10px] font-bold uppercase tracking-widest text-white [writing-mode:vertical-rl]">Margen</div>
        </div>
        <div className="mt-2 flex justify-between text-[10px] font-semibold uppercase text-soft"><span>↑ Actividades de apoyo</span><span>Actividades primarias →</span></div>
      </div>
      <AnimatePresence mode="wait">
        {s ? (
          <motion.div key={sel} className="card mt-4 p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="flex items-center gap-2"><h3 className="font-semibold">{s.actividad}</h3>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${EVAL_CLS[s.evaluacion]}`}>{s.evaluacion}</span>
              <span className="text-xs text-soft">· actividad {s.tipo === "primaria" ? "primaria" : "de apoyo"}</span></div>
            <CiteText text={s.analisis} refs={refs} className="mt-2 text-sm leading-relaxed" />
            {!!s.procesos?.length && <>
              <p className="label mt-4">Procesos principales</p>
              <Stagger as="ol" className="grid gap-1.5 text-sm sm:grid-cols-2" gap={0.04}>
                {s.procesos.map((pr, j) => <motion.li key={j} variants={item} className="flex gap-2 rounded-lg bg-[#fbfaf7] px-3 py-1.5"><span className="font-bold text-brand">{j + 1}.</span>{pr}</motion.li>)}
              </Stagger>
            </>}
          </motion.div>
        ) : <motion.p key="hint" className="mt-4 text-sm text-soft" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>Toca una actividad para ver su análisis y sus procesos principales.</motion.p>}
      </AnimatePresence>
      </>}
    </div>
  );
}

// ---------------- PESTEL ----------------
export function PestelTool({ result }: ToolProps) {
  const pe = result.plan.pestel;
  const [dim, setDim] = useState<PestelDimension | null>(null);
  const [eff, setEff] = useState<"todos" | "oportunidad" | "amenaza">("todos");
  if (!pe) return null;
  const items = pe.filter((x) => (!dim || x.dimension === dim) && (eff === "todos" || x.efecto === eff));
  const opp = pe.filter((x) => x.efecto === "oportunidad").length;
  return (
    <div>
      <Stagger className="grid grid-cols-3 gap-2 md:grid-cols-6" gap={0.05}>
        {PESTEL.map((d) => {
          const all = pe.filter((x) => x.dimension === d.key);
          const o = all.filter((x) => x.efecto === "oportunidad").length;
          const on = dim === d.key;
          return (
            <motion.button type="button" key={d.key} variants={item} whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }} onClick={() => setDim(on ? null : d.key)}
              className={`card p-3 text-left transition-colors ${on ? "!border-ink !bg-ink text-white" : ""}`}>
              <span className="display text-3xl font-bold leading-none">{d.letter}</span>
              <p className={`mt-1 text-xs font-semibold ${on ? "text-white/80" : "text-soft"}`}>{d.label}</p>
              <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-[#ece9e0]">
                <motion.div className="bg-emerald-500" initial={{ width: 0 }} animate={{ width: `${all.length ? (o / all.length) * 100 : 0}%` }} transition={{ delay: 0.3, duration: 0.8 }} />
                <motion.div className="bg-red-500" initial={{ width: 0 }} animate={{ width: `${all.length ? ((all.length - o) / all.length) * 100 : 0}%` }} transition={{ delay: 0.3, duration: 0.8 }} />
              </div>
              <p className={`mt-1 text-[10px] ${on ? "text-white/70" : "text-soft"}`}>{o} op. · {all.length - o} am.</p>
            </motion.button>
          );
        })}
      </Stagger>
      <div className="my-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented id="pestel" value={eff} onChange={setEff} options={[{ key: "todos", label: `Todos (${pe.length})` }, { key: "oportunidad", label: `Oportunidades (${opp})` }, { key: "amenaza", label: `Amenazas (${pe.length - opp})` }]} />
        {dim && <button className="text-sm font-semibold text-brand hover:underline" onClick={() => setDim(null)}>Quitar filtro: {PESTEL.find((d) => d.key === dim)?.label} ✕</button>}
      </div>
      <motion.div layout className="grid gap-3 md:grid-cols-2">
        <AnimatePresence mode="popLayout">
          {items.map((x) => (
            <motion.div layout key={x.dimension + x.factor} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className={`card border-l-4 p-4 ${x.efecto === "oportunidad" ? "border-l-emerald-500" : "border-l-red-500"}`}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-brand-dark">{PESTEL.find((d) => d.key === x.dimension)?.label}</span>
                <span className="flex items-center gap-1 text-[10px] font-semibold uppercase text-soft">impacto
                  {[1, 2, 3].map((n) => <span key={n} className={`h-2 w-2 rounded-full ${n <= (x.impacto === "alta" ? 3 : x.impacto === "media" ? 2 : 1) ? (x.efecto === "oportunidad" ? "bg-emerald-500" : "bg-red-500") : "bg-[#ece9e0]"}`} />)}
                </span>
              </div>
              <p className="text-sm">{x.factor}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
      {!items.length && <p className="text-sm text-soft">No hay factores con ese filtro.</p>}
    </div>
  );
}

// ---------------- Porter ----------------
export function PorterTool({ result }: ToolProps) {
  const po = result.plan.porter;
  const refs = useRefs(result);
  const [sel, setSel] = useState<(typeof FORCES)[number]["key"]>("rivalidad");
  if (!po) return null;
  const cx = 150, cy = 140, R = 105;
  const ang = (i: number) => (-90 + i * 72) * (Math.PI / 180);
  const pt = (i: number, v: number) => [cx + R * (v / 5) * Math.cos(ang(i)), cy + R * (v / 5) * Math.sin(ang(i))];
  const poly = FORCES.map((f, i) => pt(i, Math.min(5, Math.max(0, Number(po[f.key].puntaje) || 0))).join(",")).join(" ");
  const avg = FORCES.reduce((s, f) => s + (Number(po[f.key].puntaje) || 0), 0) / FORCES.length;
  const f = po[sel];
  const tone = (l: Level) => (l === "alta" ? "var(--bad)" : l === "media" ? "var(--warn)" : "var(--good)");
  return (
    <div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="card self-start p-4">
          <svg viewBox="-60 0 420 290" className="mx-auto w-full max-w-lg" role="img" aria-label="Radar de las cinco fuerzas">
            {[1, 2, 3, 4, 5].map((lv) => (
              <polygon key={lv} points={FORCES.map((_, i) => pt(i, lv).join(",")).join(" ")} fill={lv === 5 ? "#fbfaf7" : "none"} stroke="#e4e2da" strokeWidth={1} />
            ))}
            {FORCES.map((_, i) => { const [x, y] = pt(i, 5); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e4e2da" />; })}
            <motion.g initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 120, damping: 16, delay: 0.15 }} >
              <polygon points={poly} fill="rgb(232 115 12 / 0.18)" stroke="var(--accent)" strokeWidth={2.5} strokeLinejoin="round" />
              {FORCES.map((fo, i) => { const [x, y] = pt(i, Number(po[fo.key].puntaje) || 0); return (
                <circle key={fo.key} cx={x} cy={y} r={sel === fo.key ? 7 : 5} fill={tone(po[fo.key].intensidad)} stroke="#fff" strokeWidth={2} className="cursor-pointer" onClick={() => setSel(fo.key)} />
              ); })}
            </motion.g>
            {FORCES.map((fo, i) => {
              const [x, y] = pt(i, 6.1);
              return (
                <text key={fo.key} x={x} y={y} textAnchor={Math.abs(x - cx) < 10 ? "middle" : x > cx ? "start" : "end"} dominantBaseline="middle"
                  className={`cursor-pointer text-[11px] font-semibold ${sel === fo.key ? "fill-[var(--ink)]" : "fill-[var(--ink-soft)]"}`} onClick={() => setSel(fo.key)}>
                  {fo.short} · {po[fo.key].puntaje}
                </text>
              );
            })}
          </svg>
        </div>
        <div className="flex flex-col gap-3">
          <div className="card flex items-center gap-4 p-4">
            <Gauge value={avg} min={1} max={5} tone={avg >= 3.5 ? "var(--bad)" : avg >= 2.5 ? "var(--warn)" : "var(--good)"} size={130} />
            <div>
              <p className="label !mb-0">Presión competitiva promedio</p>
              <p className="display text-3xl font-bold"><CountUp value={avg} decimals={1} /> <span className="text-base text-soft">/ 5</span></p>
              <p className="text-sm font-semibold" style={{ color: avg >= 3.5 ? "var(--bad)" : avg >= 2.5 ? "var(--warn)" : "var(--good)" }}>
                Sector {avg >= 3.5 ? "poco atractivo" : avg >= 2.5 ? "moderadamente atractivo" : "atractivo"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FORCES.map((fo) => (
              <button key={fo.key} onClick={() => setSel(fo.key)} className={`relative rounded-lg border px-2.5 py-1 text-xs font-semibold ${sel === fo.key ? "border-ink text-white" : "border-line bg-white text-soft"}`}>
                {sel === fo.key && <motion.span layoutId="porter-pill" className="absolute inset-0 rounded-lg bg-ink" />}
                <span className="relative">{fo.short}</span>
              </button>
            ))}
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={sel} className="card flex-1 p-4" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
              <div className="flex items-start justify-between gap-2"><h3 className="font-semibold">{FORCES.find((x) => x.key === sel)?.label}</h3><LevelBadge l={f.intensidad} /></div>
              <div className="mt-2 h-2 rounded-full bg-[#ece9e0]"><motion.div className="h-2 rounded-full" style={{ background: tone(f.intensidad) }} initial={{ width: 0 }} animate={{ width: `${(Number(f.puntaje) / 5) * 100}%` }} /></div>
              <ul className="mt-3 space-y-1.5 text-sm">{f.factores.map((t, i) => (
                <motion.li key={i} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.06 }} className="flex gap-2"><span className="text-accent">▸</span>{t}</motion.li>
              ))}</ul>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <Note><CiteText text={`Conclusión: ${po.conclusion}`} refs={refs} /></Note>
    </div>
  );
}

// ---------------- MPC ----------------
export function MpcTool({ result, subject }: ToolProps) {
  const mpc = result.plan.mpc;
  const refs = useRefs(result);
  const totals = [...(result.mpcTotals ?? [])].sort((a, b) => b.total - a.total);
  const [hover, setHover] = useState<string | null>(null);
  if (!mpc || !totals.length) return null;
  const firms = (result.mpcTotals ?? []).map((t) => t.empresa);
  const isOwn = (n: string) => n.toLowerCase() === subject.toLowerCase();
  const heat = (c: number) => ["bg-red-100", "bg-amber-100", "bg-emerald-100", "bg-emerald-300"][Math.min(3, Math.max(0, c - 1))];
  return (
    <div>
      <div className="card space-y-3 p-5">
        <p className="label">Total ponderado (máx. 4)</p>
        {totals.map((t, i) => (
          <div key={t.empresa} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3 sm:grid-cols-[11rem_1fr_3.5rem]" onMouseEnter={() => setHover(t.empresa)} onMouseLeave={() => setHover(null)}>
            <span className={`truncate text-sm ${isOwn(t.empresa) ? "font-bold" : ""}`}>{i === 0 && "🏆 "}{t.empresa}</span>
            <div className="h-7 rounded-lg bg-[#f3f1ea]">
              <motion.div className={`h-7 rounded-lg ${isOwn(t.empresa) ? "bg-brand" : "bg-slate-400"}`} initial={{ width: 0 }} animate={{ width: `${(t.total / 4) * 100}%` }}
                transition={{ delay: 0.1 + i * 0.12, type: "spring", stiffness: 90, damping: 18 }} />
            </div>
            <span className="display text-right text-lg font-bold"><CountUp value={t.total} decimals={2} /></span>
          </div>
        ))}
      </div>
      <div className="card mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-soft">
            <th className="px-4 py-2.5">Factor clave de éxito</th><th className="px-3 py-2.5 text-right">Peso</th>
            {firms.map((f) => <th key={f} onMouseEnter={() => setHover(f)} onMouseLeave={() => setHover(null)} className={`px-3 py-2.5 text-center ${isOwn(f) ? "text-ink" : ""} ${hover === f ? "bg-[#f3f1ea]" : ""}`}>{f}</th>)}
          </tr></thead>
          <tbody>{mpc.factores.map((f, i) => (
            <motion.tr key={i} className="border-b border-line" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 + i * 0.05 }}>
              <td className="px-4 py-2">{f.factor}</td><td className="px-3 py-2 text-right tabular-nums text-soft">{f.peso.toFixed(2)}</td>
              {firms.map((n) => { const c = f.calificaciones.find((x) => x.empresa === n); return (
                <td key={n} className={`px-1.5 py-1.5 text-center ${hover && hover !== n ? "opacity-40" : ""}`}>
                  {c ? <span className={`inline-block min-w-12 rounded-md px-2 py-1 font-semibold tabular-nums ${heat(c.calificacion)}`}>{c.calificacion}<span className="ml-1 text-[10px] font-normal text-soft">{(c.calificacion * f.peso).toFixed(2)}</span></span> : "—"}
                </td>
              ); })}
            </motion.tr>
          ))}</tbody>
        </table>
      </div>
      <Note><CiteText text={mpc.conclusion} refs={refs} /></Note>
    </div>
  );
}

// ---------------- FODA / EFI-EFE / IE ----------------
function FactorBars({ title, total, groups }: { title: string; total: number; groups: { label: string; items: MatrixFactor[]; color: string }[] }) {
  const max = Math.max(0.01, ...groups.flatMap((g) => g.items.map((f) => f.peso * f.calificacion)));
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className={`text-sm font-semibold ${total >= 2.5 ? "text-good" : "text-bad"}`}>{total >= 2.5 ? "Por encima del promedio" : "Por debajo del promedio"}</p>
        </div>
        <Gauge value={total} mark={2.5} tone={total >= 2.5 ? "var(--good)" : "var(--bad)"} size={120}
          label={<span className="display -mt-1 text-2xl font-bold"><CountUp value={total} decimals={2} /></span>} />
      </div>
      {groups.map((g) => (
        <div key={g.label} className="mt-3">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-soft">{g.label}</p>
          <ul className="space-y-1.5">{[...g.items].sort((a, b) => b.peso * b.calificacion - a.peso * a.calificacion).map((f, i) => (
            <li key={i} className="group">
              <div className="flex items-baseline justify-between gap-2 text-sm"><span className="truncate group-hover:whitespace-normal">{f.factor}</span><span className="shrink-0 text-xs tabular-nums text-soft">{f.peso.toFixed(2)} × {f.calificacion} = <strong className="text-ink">{(f.peso * f.calificacion).toFixed(2)}</strong></span></div>
              <div className="mt-0.5 h-1.5 rounded-full bg-[#f3f1ea]"><motion.div className="h-1.5 rounded-full" style={{ background: g.color }} initial={{ width: 0 }} animate={{ width: `${((f.peso * f.calificacion) / max) * 100}%` }} transition={{ delay: 0.2 + i * 0.05, duration: 0.6 }} /></div>
            </li>
          ))}</ul>
        </div>
      ))}
    </div>
  );
}

export function IeTool({ result }: ToolProps) {
  const { ie, efiTotal: efi, efeTotal: efe } = result;
  if (!ie || efi == null || efe == null) return null;
  const zone = (n: number) => { const d = Math.floor((n - 1) / 3) + ((n - 1) % 3); return d <= 1 ? "bg-emerald-100" : d === 2 ? "bg-amber-100" : "bg-red-100"; };
  const x = Math.min(1, Math.max(0, (4 - efi) / 3)) * 100, y = Math.min(1, Math.max(0, (4 - efe) / 3)) * 100;
  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
      <div className="card p-5">
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <div className="flex flex-col justify-around pr-1 text-right text-[10px] font-semibold uppercase text-soft"><span>Alto<br />3–4</span><span>Medio<br />2–3</span><span>Bajo<br />1–2</span></div>
          <div className="relative">
            <div className="grid grid-cols-3 gap-1">
              {ROMAN.map((r, i) => (
                <motion.div key={r} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}
                  className={`flex h-20 items-center justify-center rounded-md text-lg font-bold ${zone(i + 1)} ${ie.cuadrante === i + 1 ? "text-ink" : "text-ink/30"}`}>{r}</motion.div>
              ))}
            </div>
            <motion.div className="absolute z-10 -ml-3 -mt-3 h-6 w-6 rounded-full border-[3px] border-white bg-ink shadow-lg"
              initial={{ left: "50%", top: "50%", scale: 0 }} animate={{ left: `${x}%`, top: `${y}%`, scale: 1 }} transition={{ type: "spring", stiffness: 70, damping: 12, delay: 0.5 }}>
              <motion.span className="absolute inset-0 rounded-full bg-ink" animate={{ scale: [1, 2.2], opacity: [0.5, 0] }} transition={{ repeat: Infinity, duration: 1.6 }} />
            </motion.div>
          </div>
          <span />
          <div className="grid grid-cols-3 text-center text-[10px] font-semibold uppercase text-soft"><span>Fuerte 3–4</span><span>Promedio 2–3</span><span>Débil 1–2</span></div>
        </div>
        <p className="mt-2 text-center text-[10px] font-semibold uppercase text-soft">Eje X: total EFI · Eje Y: total EFE</p>
      </div>
      <div className="flex flex-col gap-3">
        <div className="card p-5">
          <p className="label">Posición</p>
          <p className="display text-4xl font-bold">Cuadrante {ROMAN[ie.cuadrante - 1]}</p>
          <p className={`mt-1 text-lg font-semibold ${ie.estrategia === "Crecer y construir" ? "text-good" : ie.estrategia === "Conservar y mantener" ? "text-warn" : "text-bad"}`}>{ie.estrategia}</p>
          <p className="mt-2 text-sm text-soft">EFI {efi.toFixed(2)} · EFE {efe.toFixed(2)}</p>
        </div>
        <div className="card space-y-1.5 p-4 text-xs">
          <p className="flex gap-2"><span className="h-3 w-3 shrink-0 rounded bg-emerald-100" />Crecer y construir: estrategias intensivas e integración.</p>
          <p className="flex gap-2"><span className="h-3 w-3 shrink-0 rounded bg-amber-100" />Conservar y mantener: penetración y desarrollo de producto.</p>
          <p className="flex gap-2"><span className="h-3 w-3 shrink-0 rounded bg-red-100" />Cosechar o desinvertir.</p>
        </div>
      </div>
    </div>
  );
}

export function FodaTool(props: ToolProps) {
  const { plan: p, efiTotal, efeTotal } = props.result;
  const [view, setView] = useState<"foda" | "matrices" | "ie">("foda");
  if (!p.foda) return null;
  const Q = [
    { k: "fortalezas", t: "Fortalezas", l: "F", cls: "border-t-emerald-500", tc: "text-good" },
    { k: "debilidades", t: "Debilidades", l: "D", cls: "border-t-red-500", tc: "text-bad" },
    { k: "oportunidades", t: "Oportunidades", l: "O", cls: "border-t-sky-500", tc: "text-sky-700" },
    { k: "amenazas", t: "Amenazas", l: "A", cls: "border-t-amber-500", tc: "text-warn" },
  ] as const;
  return (
    <div>
      <div className="mb-4"><Segmented id="foda" value={view} onChange={setView} options={[{ key: "foda", label: "Cuadrantes FODA" }, { key: "matrices", label: "Matrices EFI / EFE" }, { key: "ie", label: "Matriz IE" }]} /></div>
      <AnimatePresence mode="wait">
        <motion.div key={view} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
          {view === "foda" && (
            <div className="grid grid-cols-[auto_1fr_1fr] gap-2">
              <span /><p className="text-center text-[10px] font-bold uppercase text-soft">Positivo</p><p className="text-center text-[10px] font-bold uppercase text-soft">Negativo</p>
              {[0, 2].map((row) => [
                <p key={`l${row}`} className="flex items-center text-[10px] font-bold uppercase text-soft [writing-mode:vertical-rl] rotate-180">{row === 0 ? "Interno" : "Externo"}</p>,
                ...Q.slice(row, row + 2).map((q, qi) => (
                  <motion.div key={q.k} className={`card relative overflow-hidden border-t-4 p-4 ${q.cls}`} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: (row + qi) * 0.08 }}>
                    <span className={`display pointer-events-none absolute -right-1 -top-4 text-7xl font-bold opacity-10 ${q.tc}`}>{q.l}</span>
                    <h3 className={`mb-2 text-sm font-bold uppercase tracking-wide ${q.tc}`}>{q.t}</h3>
                    <Stagger as="ul" className="space-y-1.5 text-sm" gap={0.04} delay={0.15 + (row + qi) * 0.08}>
                      {p.foda![q.k].map((t, i) => <motion.li key={i} variants={item} className="rounded-lg bg-[#fbfaf7] px-2.5 py-1.5">{t}</motion.li>)}
                    </Stagger>
                  </motion.div>
                )),
              ])}
            </div>
          )}
          {view === "matrices" && p.matriz_efi && p.matriz_efe && efiTotal != null && efeTotal != null && (
            <div className="grid gap-4 md:grid-cols-2">
              <FactorBars title="EFI · Factores internos" total={efiTotal} groups={[{ label: "Fortalezas", items: p.matriz_efi.fortalezas, color: "var(--good)" }, { label: "Debilidades", items: p.matriz_efi.debilidades, color: "var(--bad)" }]} />
              <FactorBars title="EFE · Factores externos" total={efeTotal} groups={[{ label: "Oportunidades", items: p.matriz_efe.oportunidades, color: "#0284c7" }, { label: "Amenazas", items: p.matriz_efe.amenazas, color: "var(--warn)" }]} />
              <p className="text-xs text-soft md:col-span-2">Pesos normalizados a 1; calificación de 1 a 4. La línea punteada marca 2.5, el promedio.</p>
            </div>
          )}
          {view === "ie" && <IeTool {...props} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ---------------- BCG ----------------
const BCG_Q: Record<BcgQuadrant, { label: string; fill: string; dot: string }> = {
  estrella: { label: "★ Estrellas", fill: "#ecfdf5", dot: "#059669" },
  interrogante: { label: "? Interrogantes", fill: "#fffbeb", dot: "#d97706" },
  vaca: { label: "$ Vacas lecheras", fill: "#f0f9ff", dot: "#0284c7" },
  perro: { label: "✕ Perros", fill: "#fef2f2", dot: "#dc2626" },
};
export function BcgTool({ result }: ToolProps) {
  const bcg = result.plan.bcg;
  const refs = useRefs(result);
  const [sel, setSel] = useState(0);
  if (!bcg?.unidades.length) return null;
  const W = 460, H = 320, L = 44, T = 16, PW = W - L - 16, PH = H - T - 40;
  const gs = bcg.unidades.map((u) => u.crecimiento_mercado);
  const gMin = Math.min(-5, Math.floor(Math.min(...gs) - 3)), gMax = Math.max(25, Math.ceil(Math.max(...gs) + 3));
  // Participación relativa en escala logarítmica de 10× (izquierda) a 0.1× (derecha): el corte en 1× queda al centro.
  const sx = (s: number) => L + ((1 - Math.log10(Math.min(10, Math.max(0.1, s)))) / 2) * PW;
  const sy = (g: number) => T + ((gMax - g) / (gMax - gMin)) * PH;
  const u = bcg.unidades[sel] ?? bcg.unidades[0];
  return (
    <div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="card self-start p-3">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Matriz BCG">
            {(["estrella", "interrogante", "vaca", "perro"] as const).map((q) => {
              const left = q === "estrella" || q === "vaca", top = q === "estrella" || q === "interrogante";
              const x = left ? L : sx(1), y = top ? T : sy(10);
              return <g key={q}><rect x={x} y={y} width={left ? sx(1) - L : L + PW - sx(1)} height={top ? sy(10) - T : T + PH - sy(10)} fill={BCG_Q[q].fill} />
                <text x={x + 8} y={y + 16} className="fill-[var(--ink-soft)] text-[11px] font-bold">{BCG_Q[q].label}</text></g>;
            })}
            <line x1={L} x2={L + PW} y1={sy(10)} y2={sy(10)} stroke="#cbd5e1" strokeDasharray="4 3" />
            <line x1={sx(1)} x2={sx(1)} y1={T} y2={T + PH} stroke="#cbd5e1" strokeDasharray="4 3" />
            {[gMin, 0, 10, gMax].filter((v, i, a) => a.indexOf(v) === i).map((g) => <text key={g} x={L - 6} y={sy(g)} textAnchor="end" dominantBaseline="middle" className="fill-[var(--ink-soft)] text-[10px]">{g}%</text>)}
            {[10, 1, 0.1].map((s) => <text key={s} x={sx(s)} y={T + PH + 14} textAnchor="middle" className="fill-[var(--ink-soft)] text-[10px]">{s}×</text>)}
            <text x={L + PW / 2} y={H - 4} textAnchor="middle" className="fill-[var(--ink-soft)] text-[10px] font-semibold uppercase">← Participación relativa alta · baja →</text>
            {bcg.unidades.map((x, i) => (
              <motion.g key={x.unidad} className="cursor-pointer" onClick={() => setSel(i)} onMouseEnter={() => setSel(i)}
                initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 + i * 0.1, type: "spring", stiffness: 200, damping: 14 }}>
                <circle cx={sx(x.participacion_relativa)} cy={sy(x.crecimiento_mercado)} r={sel === i ? 14 : 11} fill={BCG_Q[x.cuadrante].dot} fillOpacity={sel === i ? 1 : 0.8} stroke={sel === i ? "var(--ink)" : "#fff"} strokeWidth={2.5} />
                <text x={sx(x.participacion_relativa)} y={sy(x.crecimiento_mercado)} textAnchor="middle" dominantBaseline="central" className="pointer-events-none fill-white text-[10px] font-bold">{i + 1}</text>
              </motion.g>
            ))}
            {(() => { const x = bcg.unidades[sel]; if (!x) return null; const cxp = sx(x.participacion_relativa), cyp = sy(x.crecimiento_mercado);
              return <text x={Math.min(L + PW - 4, Math.max(L + 4, cxp))} y={cyp - 21} textAnchor={cxp > L + PW - 60 ? "end" : cxp < L + 60 ? "start" : "middle"} className="pointer-events-none fill-[var(--ink)] text-[11px] font-bold">{x.unidad.length > 34 ? x.unidad.slice(0, 33) + "…" : x.unidad}</text>; })()}
          </svg>
          <p className="px-2 text-[10px] text-soft">Eje Y: crecimiento anual estimado del mercado (alto ≥ 10 %). Eje X: participación frente al líder (alta ≥ 1×), escala logarítmica.</p>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">{bcg.unidades.map((x, i) => (
            <button key={x.unidad} onClick={() => setSel(i)} className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${sel === i ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>
              <span className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: BCG_Q[x.cuadrante].dot }}>{i + 1}</span>{x.unidad}</button>
          ))}</div>
          <AnimatePresence mode="wait">
            <motion.div key={sel} className="card flex-1 p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: BCG_Q[u.cuadrante].dot }}>{BCG_Q[u.cuadrante].label}</p>
              <h3 className="display mt-1 text-xl font-bold">{u.unidad}</h3>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-[#fbfaf7] p-3"><p className="text-[10px] font-semibold uppercase text-soft">Crec. mercado</p><p className="display text-2xl font-bold"><CountUp value={u.crecimiento_mercado} decimals={1} suffix=" %" /></p></div>
                <div className="rounded-lg bg-[#fbfaf7] p-3"><p className="text-[10px] font-semibold uppercase text-soft">Part. relativa</p><p className="display text-2xl font-bold"><CountUp value={u.participacion_relativa} decimals={2} suffix="×" /></p></div>
              </div>
              <p className="mt-3 text-sm"><strong>Estrategia:</strong> {u.estrategia}</p>
              <p className="mt-1 text-xs text-soft">Base de la estimación: {u.base_estimacion}</p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <Note><CiteText text={bcg.conclusion} refs={refs} /></Note>
    </div>
  );
}

// ---------------- Ansoff ----------------
const ANSOFF: { key: AnsoffKey; label: string; hint: string }[] = [
  { key: "desarrollo_mercado", label: "Desarrollo de mercado", hint: "Producto actual · mercado nuevo" },
  { key: "diversificacion", label: "Diversificación", hint: "Producto nuevo · mercado nuevo" },
  { key: "penetracion", label: "Penetración de mercado", hint: "Producto actual · mercado actual" },
  { key: "desarrollo_producto", label: "Desarrollo de producto", hint: "Producto nuevo · mercado actual" },
];
export function AnsoffTool({ result }: ToolProps) {
  const a = result.plan.ansoff;
  const refs = useRefs(result);
  const [sel, setSel] = useState<AnsoffKey | null>(null);
  if (!a) return null;
  const cur = sel ?? a.recomendada;
  return (
    <div>
      <div className="grid grid-cols-[auto_1fr] gap-2">
        <div className="flex flex-col justify-around text-[10px] font-bold uppercase text-soft [writing-mode:vertical-rl] rotate-180"><span>Mercado actual</span><span>Mercado nuevo</span></div>
        <div className="grid grid-cols-2 gap-2">
          {ANSOFF.map((q, i) => {
            const rec = a.recomendada === q.key, on = cur === q.key;
            return (
              <motion.button type="button" key={q.key} onClick={() => setSel(q.key)} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.08 }} whileHover={{ y: -3 }}
                className={`card relative min-h-36 p-4 text-left ${on ? "!border-ink" : ""} ${rec ? "!bg-[#eef7f5]" : ""}`}>
                {rec && <motion.span className="absolute inset-0 rounded-[14px] ring-2 ring-brand" animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 2 }} />}
                <div className="flex items-start justify-between gap-2"><h3 className="font-semibold">{q.label}</h3>
                  {rec && <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold uppercase text-white">recomendada</span>}</div>
                <p className="text-xs text-soft">{q.hint}</p>
                <p className="display mt-3 text-3xl font-bold text-ink/80">{a[q.key].length}<span className="ml-1 text-xs font-normal text-soft">opciones</span></p>
              </motion.button>
            );
          })}
        </div>
        <span />
        <div className="grid grid-cols-2 text-center text-[10px] font-bold uppercase text-soft"><span>Producto actual</span><span>Producto nuevo</span></div>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={cur} className="card mt-4 p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
          <h3 className="font-semibold">{ANSOFF.find((q) => q.key === cur)?.label}</h3>
          <Stagger as="ul" className="mt-2 space-y-2 text-sm" gap={0.06}>
            {a[cur].map((t, i) => <motion.li key={i} variants={item} className="flex gap-2 rounded-lg bg-[#fbfaf7] px-3 py-2"><span className="font-bold text-brand">{i + 1}.</span>{t}</motion.li>)}
          </Stagger>
        </motion.div>
      </AnimatePresence>
      <Note><CiteText text={`Por qué ${ANSOFF.find((q) => q.key === a.recomendada)?.label.toLowerCase()}: ${a.justificacion}`} refs={refs} /></Note>
    </div>
  );
}

// ---------------- Estrategias y KPI ----------------
const BSC: StrategicPlan["objetivos_estrategicos"][number]["perspectiva"][] = ["Financiera", "Clientes", "Procesos internos", "Aprendizaje y crecimiento"];
function StrategyCard({ e }: { e: StrategyItem }) {
  const [open, setOpen] = useState(false);
  const q = QUADRANTS.find((x) => x.key === e.tipo)!;
  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="card overflow-hidden">
      <button type="button" className="w-full p-4 text-left" onClick={() => setOpen(!open)}>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold text-white ${q.cls}`}>{e.tipo}</span>
          <h4 className="flex-1 font-semibold">{e.titulo}</h4>
          <LevelBadge l={e.prioridad} prefix="prioridad " />
        </div>
        <p className="mt-1 text-sm text-soft">{e.descripcion}</p>
        <div className="mt-3 flex items-center justify-between rounded-lg bg-[#fbfaf7] px-3 py-2 text-xs">
          <span><span className="font-semibold text-soft">KPI · </span><strong>{e.kpi.nombre}</strong></span>
          <motion.span animate={{ rotate: open ? 180 : 0 }} className="text-soft">▾</motion.span>
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.dl initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 overflow-hidden px-4 text-xs">
            <dt className="font-semibold text-soft">Fórmula</dt><dd className="font-mono">{e.kpi.formula}</dd>
            <dt className="font-semibold text-soft">Tipo</dt><dd>{e.kpi.tipo_indicador} · {e.kpi.perspectiva}</dd>
            <dt className="font-semibold text-soft">Fuente</dt><dd>{e.kpi.fuente_informacion} <span className="text-soft">({e.kpi.tipo_fuente})</span></dd>
            <dt className="font-semibold text-soft">Línea base</dt><dd>{e.kpi.linea_base}</dd>
            <dt className="font-semibold text-soft">Meta</dt><dd className="font-semibold text-brand-dark">{e.kpi.meta} <span className="font-normal text-soft">· {e.kpi.frecuencia}</span></dd>
            <dd className="col-span-2 h-3" />
          </motion.dl>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function StrategiesTool({ result }: ToolProps) {
  const p = result.plan;
  const [view, setView] = useState<"cards" | "bsc" | "table">("cards");
  const [quad, setQuad] = useState<StrategyItem["tipo"] | null>(null);
  const [prio, setPrio] = useState<Level | null>(null);
  if (!p.estrategias) return null;
  const list = p.estrategias.filter((e) => (!quad || e.tipo === quad) && (!prio || e.prioridad === prio));
  return (
    <div>
      <div className="mb-4"><Segmented id="strat" value={view} onChange={setView} options={[{ key: "cards", label: "FODA cruzado" }, { key: "bsc", label: "Mapa estratégico BSC" }, { key: "table", label: "Tablero de KPI" }]} /></div>
      <AnimatePresence mode="wait">
        <motion.div key={view} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
          {view === "cards" && <>
            <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
              {QUADRANTS.map((q) => {
                const n = p.estrategias!.filter((e) => e.tipo === q.key).length, on = quad === q.key;
                return (
                  <motion.button type="button" key={q.key} whileTap={{ scale: 0.97 }} onClick={() => setQuad(on ? null : q.key)}
                    className={`card p-3 text-left ${on ? "!border-ink ring-1 ring-ink" : ""} ${quad && !on ? "opacity-50" : ""}`}>
                    <div className="flex items-center justify-between"><span className={`rounded px-1.5 py-0.5 text-xs font-bold text-white ${q.cls}`}>{q.key}</span><span className="display text-2xl font-bold">{n}</span></div>
                    <p className="mt-1 text-xs font-semibold">{q.label.split(" · ")[1]}</p>
                    <p className="text-[10px] text-soft">{q.hint}</p>
                  </motion.button>
                );
              })}
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="font-semibold text-soft">Prioridad:</span>
              {([null, "alta", "media", "baja"] as const).map((l) => (
                <button key={l ?? "all"} onClick={() => setPrio(l)} className={`rounded-full border px-2.5 py-0.5 font-semibold ${prio === l ? "border-ink bg-ink text-white" : "border-line bg-white text-soft"}`}>{l ?? "todas"}</button>
              ))}
            </div>
            <motion.div layout className="grid gap-3 md:grid-cols-2">
              <AnimatePresence mode="popLayout">{list.map((e) => <StrategyCard key={e.tipo + e.titulo} e={e} />)}</AnimatePresence>
            </motion.div>
          </>}
          {view === "bsc" && (
            <div className="space-y-2">
              {BSC.map((b, bi) => {
                const objs = (p.objetivos_estrategicos ?? []).filter((o) => o.perspectiva === b);
                const kpis = p.estrategias!.filter((e) => e.kpi.perspectiva === b);
                return (
                  <motion.div key={b} className="card grid gap-3 p-4 md:grid-cols-[10rem_1fr]" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: bi * 0.1 }}>
                    <div><p className="text-xs font-bold uppercase tracking-wide text-brand-dark">{b}</p><p className="text-[10px] text-soft">{objs.length} objetivos · {kpis.length} KPI</p></div>
                    <div className="flex flex-wrap gap-2">
                      {objs.map((o, i) => <span key={i} className="rounded-xl border border-brand/30 bg-[#eef7f5] px-3 py-1.5 text-sm">🎯 {o.objetivo} <span className="text-xs text-soft">· {o.plazo}</span></span>)}
                      {kpis.map((e, i) => <span key={`k${i}`} className="rounded-xl border border-line bg-white px-3 py-1.5 text-xs"><strong>{e.kpi.nombre}</strong> → {e.kpi.meta}</span>)}
                      {!objs.length && !kpis.length && <span className="text-sm text-soft">Sin elementos en esta perspectiva.</span>}
                    </div>
                  </motion.div>
                );
              })}
              <p className="text-center text-[10px] font-semibold uppercase text-soft">↑ Cada perspectiva sostiene a la de arriba</p>
            </div>
          )}
          {view === "table" && (
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-soft">
                  <th className="px-4 py-2.5">Estrategia</th><th className="px-3 py-2.5">KPI</th><th className="px-3 py-2.5">Fórmula</th><th className="px-3 py-2.5">Tipo</th><th className="px-3 py-2.5">Perspectiva</th><th className="px-3 py-2.5">Fuente</th><th className="px-3 py-2.5">Frecuencia</th><th className="px-4 py-2.5">Meta</th>
                </tr></thead>
                <tbody>{p.estrategias.map((e, i) => (
                  <motion.tr key={i} className="border-b border-line align-top last:border-0 hover:bg-[#fbfaf7]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                    <td className="px-4 py-2.5"><span className="mr-1 rounded bg-ink px-1.5 py-0.5 text-[10px] font-bold text-white">{e.tipo}</span>{e.titulo}</td>
                    <td className="px-3 py-2.5 font-semibold">{e.kpi.nombre}</td><td className="px-3 py-2.5 text-soft">{e.kpi.formula}</td>
                    <td className="px-3 py-2.5">{e.kpi.tipo_indicador}</td><td className="px-3 py-2.5 text-soft">{e.kpi.perspectiva}</td>
                    <td className="px-3 py-2.5">{e.kpi.fuente_informacion} <span className="text-xs text-soft">({e.kpi.tipo_fuente})</span></td>
                    <td className="px-3 py-2.5 text-soft">{e.kpi.frecuencia}</td><td className="px-4 py-2.5">{e.kpi.meta}</td>
                  </motion.tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ---------------- Evidencia ----------------
export function EvidenceTool({ result }: ToolProps) {
  const r = result.research;
  const ok = (u: string) => /^https?:\/\//.test(u);
  return (
    <Stagger className="grid gap-4 md:grid-cols-2">
      <motion.div variants={item} className="card p-5">
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-soft">Datos del entorno</h3>
        <ul className="space-y-2 text-sm">{r.entorno.map((x, i) => (
          <li key={i} className="rounded-lg bg-[#fbfaf7] px-3 py-2"><span className="mr-1 text-xs font-semibold uppercase text-brand">{PESTEL.find((d) => d.key === x.dimension)?.label ?? x.dimension}</span>{x.dato}
            {ok(x.fuente_url) && <> <a className="text-xs text-brand hover:underline" href={x.fuente_url} target="_blank" rel="noreferrer noopener">fuente ↗</a></>}</li>
        ))}</ul>
      </motion.div>
      <motion.div variants={item} className="card p-5">
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-soft">Competidores identificados</h3>
        <ul className="space-y-2 text-sm">{r.competidores.map((c, i) => (
          <li key={i}><strong>{c.nombre}</strong> — {c.descripcion}{ok(c.url) && <> <a className="text-xs text-brand hover:underline" href={c.url} target="_blank" rel="noreferrer noopener">↗</a></>}</li>
        ))}</ul>
        {r.tendencias_sector.length > 0 && <>
          <h3 className="mb-2 mt-4 text-sm font-bold uppercase tracking-wide text-soft">Tendencias del sector</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">{r.tendencias_sector.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </>}
      </motion.div>
      {r.fuentes.some((f) => ok(f.url)) && (
        <motion.p variants={item} className="text-xs text-soft md:col-span-2">Fuentes: {r.fuentes.filter((f) => ok(f.url)).map((f, i) => (
          <span key={i}>{i > 0 && " · "}<a className="text-brand hover:underline" href={f.url} target="_blank" rel="noreferrer noopener">{f.titulo || f.url}</a></span>
        ))} · <a className="font-semibold text-brand hover:underline" href="#referencias">Ver en formato APA 7 →</a></motion.p>
      )}
    </Stagger>
  );
}
