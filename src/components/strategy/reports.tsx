"use client";
import { motion } from "motion/react";
import { useEffect, type ReactNode } from "react";
import { moduleDone } from "@/lib/strategy-modules";
import type { BusinessStrategyCategory, GeneralStrategy, StrategicResult } from "@/lib/types";
import { CiteText, RefList, ToolLink, useRefs } from "./cite";
import { Stagger, item } from "./motion-kit";
import type { ToolProps } from "./tools";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"];
const GENERAL_TONE: Record<GeneralStrategy, string> = { Crecimiento: "text-good", Estabilidad: "text-warn", "Reducción": "text-bad" };
const CATEGORY_CLS: Record<BusinessStrategyCategory, string> = {
  Intensiva: "bg-emerald-600", "Integración": "bg-sky-600", "Diversificación": "bg-violet-600", Defensiva: "bg-amber-600",
};
const fecha = () => new Date().toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Lima" });

/** Cadena IE → estrategia general → estrategia competitiva → estrategias de negocio. */
function DirectionFlow({ result }: { result: StrategicResult }) {
  const d = result.plan.direccion!, ie = result.ie;
  const steps = [
    { label: "Matriz IE", value: ie ? `Cuadrante ${ROMAN[ie.cuadrante - 1]}` : "—", hint: ie?.estrategia ?? "", href: "#foda" },
    { label: "Estrategia general", value: d.estrategia_general.tipo, hint: "Nivel corporativo", tone: GENERAL_TONE[d.estrategia_general.tipo] },
    { label: "Estrategia competitiva", value: d.estrategia_competitiva.tipo, hint: "Genérica de Porter" },
    { label: "Estrategias de negocio", value: String(d.estrategias_negocio.length), hint: [...new Set(d.estrategias_negocio.map((e) => e.categoria))].join(" · ") },
  ];
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {steps.map((s, i) => {
        const body = <>
          <p className="text-[10px] font-bold uppercase tracking-wider text-soft">{i + 1}. {s.label}</p>
          <p className={`display mt-1 text-xl font-bold leading-tight ${s.tone ?? ""}`}>{s.value}</p>
          <p className="mt-0.5 text-xs text-soft">{s.hint}</p>
        </>;
        return (
          <motion.div key={s.label} className="relative" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}>
            {s.href ? <a href={s.href} className="card block h-full p-3.5 hover:border-brand">{body}</a> : <div className="card h-full p-3.5">{body}</div>}
            {i < steps.length - 1 && <span className="absolute -right-2 top-1/2 z-10 hidden -translate-y-1/2 text-lg text-soft lg:block">›</span>}
          </motion.div>
        );
      })}
    </div>
  );
}

// ---------------- Estrategia general y de negocio ----------------
export function DirectionTool({ result }: ToolProps) {
  const d = result.plan.direccion;
  const refs = useRefs(result);
  if (!d) return null;
  return (
    <Stagger className="space-y-4">
      <motion.div variants={item}><DirectionFlow result={result} /></motion.div>
      <motion.section variants={item} className="card relative overflow-hidden p-6">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-brand to-accent" />
        <p className="eyebrow">Interpretación para los dueños del negocio</p>
        <CiteText text={d.interpretacion} refs={refs} className="mt-2 leading-relaxed" />
      </motion.section>
      <motion.div variants={item} className="grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <p className="label">Estrategia general</p>
          <p className={`display text-2xl font-bold ${GENERAL_TONE[d.estrategia_general.tipo]}`}>{d.estrategia_general.tipo}</p>
          <CiteText text={d.estrategia_general.fundamento} refs={refs} className="mt-2 text-sm leading-relaxed" />
        </div>
        <div className="card p-5">
          <p className="label">Estrategia competitiva</p>
          <p className="display text-2xl font-bold">{d.estrategia_competitiva.tipo}</p>
          <CiteText text={d.estrategia_competitiva.fundamento} refs={refs} className="mt-2 text-sm leading-relaxed" />
        </div>
      </motion.div>
      <motion.div variants={item}>
        <h3 className="mb-2 font-semibold">Estrategias de negocio</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {d.estrategias_negocio.map((e, i) => (
            <div key={i} className="card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase text-white ${CATEGORY_CLS[e.categoria] ?? "bg-ink"}`}>{e.categoria}</span>
                <h4 className="flex-1 font-semibold">{e.nombre}</h4>
                <span className="text-xs text-soft">{e.horizonte}</span>
              </div>
              <CiteText text={e.descripcion} refs={refs} className="mt-1 text-sm text-soft" />
              <ul className="mt-2 space-y-1 text-sm">{e.acciones.map((a, j) => <li key={j} className="flex gap-2"><span className="text-accent">▸</span>{a}</li>)}</ul>
            </div>
          ))}
        </div>
      </motion.div>
      <motion.div variants={item} className="rounded-xl bg-[#eef7f5] px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-wide text-brand-dark">Recomendación</p>
        <CiteText text={d.recomendacion} refs={refs} className="mt-1 text-sm leading-relaxed" />
      </motion.div>
      <motion.div variants={item} className="no-print flex flex-wrap gap-2">
        <ToolLink k="foda" label="Ver FODA y matriz IE" />
        {moduleDone("ansoff", result) && <ToolLink k="ansoff" label="Ver Ansoff" />}
        {moduleDone("estrategias", result) && <ToolLink k="estrategias" label="Ver estrategias y KPI" />}
      </motion.div>
    </Stagger>
  );
}

// ---------------- Informes ----------------
function ReportShell({ kind, subject, children, toc }: { kind: string; subject: string; children: ReactNode; toc?: { id: string; label: string }[] }) {
  return (
    <article className="card mx-auto max-w-4xl p-6 sm:p-10 print:border-0 print:p-0">
      <header className="border-b border-line pb-5">
        <p className="eyebrow">{kind}</p>
        <h2 className="display mt-1 text-3xl font-bold">Plan estratégico empresarial · {subject}</h2>
        <p className="mt-1 text-sm text-soft">Elaborado por el agente Compa · {fecha()}</p>
      </header>
      {toc && (
        <nav className="no-print mt-5 rounded-xl bg-[#fbfaf7] p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-soft">Índice</p>
          <ol className="mt-1 grid gap-x-6 gap-y-0.5 text-sm sm:grid-cols-2">
            {toc.map((t) => <li key={t.id}><a href={`#${t.id}`} className="text-brand hover:underline">{t.label}</a></li>)}
          </ol>
        </nav>
      )}
      <div className="mt-6 space-y-7">{children}</div>
    </article>
  );
}

function Section({ id, n, title, children, links }: { id: string; n?: string; title: string; children: ReactNode; links?: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h3 className="display mb-2 text-xl font-bold">{n && <span className="mr-2 text-brand">{n}</span>}{title}</h3>
      <div className="leading-relaxed">{children}</div>
      {links && <div className="no-print mt-3 flex flex-wrap gap-2">{links}</div>}
    </section>
  );
}

const IG_TOC = [
  { id: "ig-1", label: "1. Presentación" }, { id: "ig-2", label: "2. Análisis de la situación actual" },
  { id: "ig-3", label: "3. Diagnóstico estratégico" }, { id: "ig-4", label: "4. Diseño de la solución" },
  { id: "ig-5", label: "5. Plan de implementación" }, { id: "ig-6", label: "6. Seguimiento y control" },
  { id: "ig-7", label: "7. Conclusiones y recomendaciones" }, { id: "ig-8", label: "Referencias" },
];

export function ManagementReportTool({ result, subject, print }: ToolProps & { print?: boolean }) {
  const r = result.plan.informe_gestion, p = result.plan;
  const refs = useRefs(result);
  if (!r) return null;
  const has = (k: Parameters<typeof moduleDone>[0]) => moduleDone(k, result);
  const link = (k: Parameters<typeof moduleDone>[0], label: string) => has(k) && <ToolLink key={k} k={k} label={label} />;
  const sid = (n: number) => (print ? undefined : `ig-${n}`) as string;
  return (
    <ReportShell kind="Informe de gestión" subject={subject} toc={print ? undefined : IG_TOC}>
      <Section id={sid(1)} n="1." title="Presentación"><CiteText text={r.presentacion} refs={refs} /></Section>
      <Section id={sid(2)} n="2." title="Análisis de la situación actual"
        links={[link("identidad", "Misión y visión"), link("canvas", "Canvas"), link("cadena_valor", "Cadena de valor"), link("pestel", "PESTEL"), link("porter", "Porter"), link("mpc", "MPC")]}>
        {p.mision && <p className="mb-3 rounded-lg bg-[#fbfaf7] px-4 py-3 text-sm"><strong>Misión:</strong> {p.mision.texto}{p.vision && <><br /><strong>Visión:</strong> {p.vision.texto}</>}</p>}
        <CiteText text={r.situacion_actual} refs={refs} />
      </Section>
      <Section id={sid(3)} n="3." title="Diagnóstico estratégico" links={[link("foda", "FODA · EFI/EFE · IE"), link("bcg", "Matriz BCG")]}>
        {result.ie && result.efiTotal != null && result.efeTotal != null && (
          <div className="mb-3 grid grid-cols-3 gap-2 text-center">
            {[["EFI", result.efiTotal.toFixed(2)], ["EFE", result.efeTotal.toFixed(2)], ["Matriz IE", `${ROMAN[result.ie.cuadrante - 1]} · ${result.ie.estrategia}`]].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-[#fbfaf7] px-2 py-2"><p className="text-[10px] font-bold uppercase text-soft">{k}</p><p className="text-sm font-semibold">{v}</p></div>
            ))}
          </div>
        )}
        <CiteText text={r.diagnostico} refs={refs} />
      </Section>
      <Section id={sid(4)} n="4." title="Diseño de la solución" links={[link("direccion", "Estrategia general y de negocio"), link("ansoff", "Ansoff"), link("estrategias", "Estrategias y KPI")]}>
        {p.direccion && (
          <p className="mb-3 rounded-lg bg-[#eef7f5] px-4 py-3 text-sm">
            <strong>Estrategia general:</strong> {p.direccion.estrategia_general.tipo} · <strong>Estrategia competitiva:</strong> {p.direccion.estrategia_competitiva.tipo}<br />
            <strong>Estrategias de negocio:</strong> {p.direccion.estrategias_negocio.map((e) => e.nombre).join("; ")}
          </p>
        )}
        <CiteText text={r.propuesta} refs={refs} />
        {!!p.objetivos_estrategicos?.length && (
          <ul className="mt-3 list-disc space-y-0.5 pl-5 text-sm">{p.objetivos_estrategicos.map((o, i) => <li key={i}>{o.objetivo} <span className="text-soft">({o.perspectiva}, {o.plazo})</span></li>)}</ul>
        )}
      </Section>
      <Section id={sid(5)} n="5." title="Plan de implementación">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-soft">
              <th className="py-2 pr-3">Acción</th><th className="px-3 py-2">Responsable</th><th className="px-3 py-2">Plazo</th><th className="px-3 py-2">Recursos</th><th className="py-2 pl-3">Indicador</th>
            </tr></thead>
            <tbody>{r.plan_implementacion.map((a, i) => (
              <tr key={i} className="border-b border-line align-top last:border-0">
                <td className="py-2 pr-3 font-medium">{a.accion}</td><td className="px-3 py-2">{a.responsable}</td><td className="px-3 py-2">{a.plazo}</td>
                <td className="px-3 py-2 text-soft">{a.recursos}</td><td className="py-2 pl-3">{a.indicador}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Section>
      <Section id={sid(6)} n="6." title="Seguimiento y control" links={[link("estrategias", "Tablero de KPI")]}>
        <CiteText text={r.seguimiento} refs={refs} />
        {!!p.estrategias?.length && (
          <ul className="mt-3 space-y-1 text-sm">{p.estrategias.map((e, i) => (
            <li key={i} className="flex flex-wrap gap-x-2"><strong>{e.kpi.nombre}</strong><span className="text-soft">{e.kpi.formula}</span><span>→ {e.kpi.meta} ({e.kpi.frecuencia})</span></li>
          ))}</ul>
        )}
      </Section>
      <Section id={sid(7)} n="7." title="Conclusiones y recomendaciones">
        <div className="grid gap-4 md:grid-cols-2">
          <div><p className="label">Conclusiones</p><ol className="list-decimal space-y-1 pl-5 text-sm">{r.conclusiones.map((c, i) => <li key={i}>{c}</li>)}</ol></div>
          <div><p className="label">Recomendaciones</p><ol className="list-decimal space-y-1 pl-5 text-sm">{r.recomendaciones.map((c, i) => <li key={i}>{c}</li>)}</ol></div>
        </div>
      </Section>
      <Section id={sid(8)} title="Referencias"><RefList refs={refs} anchor={false} /></Section>
    </ReportShell>
  );
}

export function ExecutiveReportTool({ result, subject }: ToolProps) {
  const r = result.plan.informe_ejecutivo, d = result.plan.direccion;
  const refs = useRefs(result);
  if (!r) return null;
  const tiles = [
    result.efiTotal != null && ["EFI", result.efiTotal.toFixed(2)],
    result.efeTotal != null && ["EFE", result.efeTotal.toFixed(2)],
    result.ie && ["Matriz IE", `Cuadrante ${ROMAN[result.ie.cuadrante - 1]}`],
    d && ["Estrategia general", d.estrategia_general.tipo],
  ].filter((t): t is [string, string] => !!t);
  return (
    <ReportShell kind="Informe ejecutivo" subject={subject}>
      {tiles.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {tiles.map(([k, v]) => <div key={k} className="rounded-xl bg-[#fbfaf7] p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-soft">{k}</p><p className="display text-xl font-bold">{v}</p></div>)}
        </div>
      )}
      <Section id="ie-situacion" title="Situación"><CiteText text={r.situacion} refs={refs} /></Section>
      <Section id="ie-hallazgos" title="Hallazgos clave">
        <ul className="space-y-1.5 text-sm">{r.hallazgos.map((h, i) => <li key={i} className="flex gap-2"><span className="font-bold text-brand">{i + 1}.</span><span>{h}</span></li>)}</ul>
      </Section>
      <section className="rounded-xl border-l-4 border-brand bg-[#eef7f5] px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-wide text-brand-dark">Decisión recomendada</p>
        <CiteText text={r.decision} refs={refs} className="mt-1 font-semibold leading-relaxed" />
      </section>
      <div className="grid gap-6 md:grid-cols-2">
        <Section id="ie-prioridades" title="Prioridades">
          <ol className="list-decimal space-y-1 pl-5 text-sm">{r.prioridades.map((x, i) => <li key={i}>{x}</li>)}</ol>
        </Section>
        <Section id="ie-pasos" title="Próximos pasos">
          <ol className="list-decimal space-y-1 pl-5 text-sm">{r.proximos_pasos.map((x, i) => <li key={i}>{x}</li>)}</ol>
        </Section>
      </div>
      <Section id="ie-resultados" title="Resultados esperados"><CiteText text={r.resultados_esperados} refs={refs} /></Section>
      <p className="no-print flex flex-wrap gap-2 border-t border-line pt-4">
        <ToolLink k="informe_gestion" label="Informe de gestión completo" />
        <ToolLink k="direccion" label="Estrategia general y de negocio" />
        <ToolLink k="referencias" label="Referencias APA" />
      </p>
    </ReportShell>
  );
}

// ---------------- Referencias ----------------
export function ReferencesTool({ result, anchor = true }: ToolProps & { anchor?: boolean }) {
  const refs = useRefs(result);
  // Al llegar desde una cita (#ref-…) la vista se monta después del cambio de hash: se desplaza a la referencia.
  useEffect(() => {
    if (!anchor || !location.hash.startsWith("#ref-")) return;
    const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (!el) return;
    // :target no se aplica a elementos montados después del cambio de hash: se resalta con una clase.
    const t = setTimeout(() => { el.scrollIntoView({ block: "center", behavior: "smooth" }); el.classList.add("ref-hit"); }, 80);
    const off = setTimeout(() => el.classList.remove("ref-hit"), 2600);
    return () => { clearTimeout(t); clearTimeout(off); el.classList.remove("ref-hit"); };
  }, [anchor]);
  const web = refs.filter((r) => r.tipo === "web").length;
  return (
    <div className="card p-6">
      <p className="text-sm text-soft">{refs.length} referencias en formato APA 7.ª edición, en orden alfabético: {web} fuentes consultadas por el agente y {refs.length - web} obras del marco teórico de las herramientas generadas. Las citas del reporte enlazan aquí.</p>
      <div className="mt-4"><RefList refs={refs} anchor={anchor} /></div>
    </div>
  );
}
