"use client";
// Agente 8 (informes integrados) y carga de documentos para el diagnóstico de brechas.
import { motion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { moduleDone } from "@/lib/strategy-modules";
import { ALIGN_LABEL, computeBudget, computePareto, gapIndex, kpiCoverage, money } from "@/lib/td";
import { CiteText, RefList, ToolLink, useRefs } from "./cite";
import { Icon } from "./icons";
import { Spinner } from "./motion-kit";
import { TdBar, downloadWord, type TdProps } from "./td-kit";

const fecha = () => new Date().toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Lima" });

function Shell({ id, kind, subject, children, toc }: { id: string; kind: string; subject: string; children: ReactNode; toc?: { id: string; label: string }[] }) {
  return (
    <article id={id} className="card mx-auto max-w-4xl p-6 sm:p-10 print:border-0 print:p-0">
      <header className="border-b border-line pb-5">
        <p className="eyebrow">{kind}</p>
        <h2 className="display mt-1 text-3xl font-bold">Plan estratégico y despliegue digital · {subject}</h2>
        <p className="mt-1 text-sm text-soft">Consolidado por el agente de informes de Compa a partir de los resultados de los agentes especializados · {fecha()}</p>
      </header>
      {toc && (
        <nav className="no-print mt-5 rounded-xl bg-[#fbfaf7] p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-soft">Índice</p>
          <ol className="mt-1 grid gap-x-6 gap-y-0.5 text-sm sm:grid-cols-2">{toc.map((t) => <li key={t.id}><a href={`#${t.id}`} className="text-brand hover:underline">{t.label}</a></li>)}</ol>
        </nav>
      )}
      <div className="mt-6 space-y-7">{children}</div>
    </article>
  );
}
function Sec({ id, n, title, children, links }: { id?: string; n?: string; title: string; children: ReactNode; links?: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 break-inside-avoid-page">
      <h3 className="display mb-2 text-xl font-bold">{n && <span className="mr-2 text-brand">{n}</span>}{title}</h3>
      <div className="leading-relaxed">{children}</div>
      {links && <div className="no-print mt-3 flex flex-wrap gap-2">{links}</div>}
    </section>
  );
}
const T = ({ head, rows }: { head: string[]; rows: ReactNode[][] }) => (
  <div className="mt-3 overflow-x-auto">
    <table className="w-full min-w-[560px] text-xs">
      <thead><tr className="border-b border-line text-left uppercase tracking-wide text-soft">{head.map((h) => <th key={h} className="px-2 py-1.5 font-semibold">{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-line align-top last:border-0">{r.map((c, j) => <td key={j} className="px-2 py-1.5">{c}</td>)}</tr>)}</tbody>
    </table>
  </div>
);

const TOC = [
  ["igt-1", "1. Presentación"], ["igt-2", "2. Diagnóstico"], ["igt-3", "3. Objetivos y estrategias"], ["igt-4", "4. Sistemas y tecnologías digitales"],
  ["igt-5", "5. Priorización (Pareto)"], ["igt-6", "6. Indicadores de gestión"], ["igt-7", "7. Presupuesto e inversión"], ["igt-8", "8. Responsables"],
  ["igt-9", "9. Mecanismos de seguimiento"], ["igt-10", "10. Conclusiones y recomendaciones"], ["igt-11", "Referencias"],
].map(([id, label]) => ({ id, label }));

export function TdManagementReportTool(p: TdProps & { print?: boolean }) {
  const { result, subject } = p;
  const pl = result.plan, r = pl.informe_gestion_td;
  const refs = useRefs(result);
  if (!r || !pl.std || !pl.pareto || !pl.presupuesto || !pl.kpis) return null;
  const pr = computePareto(pl.pareto, pl.std), b = computeBudget(pl.presupuesto), cov = kpiCoverage(pl.kpis, pl), cur = pl.presupuesto.moneda;
  const sid = (n: number) => (p.print ? undefined : `igt-${n}`);
  const link = (k: Parameters<typeof moduleDone>[0], label: string) => moduleDone(k, result) && <ToolLink key={k} k={k} label={label} />;
  const docId = p.print ? "print-igt" : "doc-igt";
  return (
    <div>
      {!p.print && <TdBar k="informe_gestion_td" p={p} exports={[{ label: "Word", run: () => downloadWord(docId, `informe-gestion-${subject}`, "Informe de gestión") }]} />}
      <Shell id={docId} kind="Informe de gestión del plan estratégico empresarial" subject={subject} toc={p.print ? undefined : TOC}>
        <Sec id={sid(1)} n="1." title="Presentación"><CiteText text={r.presentacion} refs={refs} /></Sec>
        <Sec id={sid(2)} n="2." title="Diagnóstico" links={[link("foda", "FODA"), link("brechas", "Brechas digitales")]}>
          <CiteText text={r.diagnostico} refs={refs} />
          {pl.brechas && <p className="mt-2 rounded-lg bg-[#fbfaf7] px-3 py-2 text-sm">Índice de alineamiento con {pl.brechas.documento_referencia}: <strong>{gapIndex(pl.brechas).indice} %</strong> en {pl.brechas.filas.length} lineamientos.</p>}
        </Sec>
        <Sec id={sid(3)} n="3." title="Objetivos y estrategias" links={[link("identidad", "Misión y visión"), link("estrategias", "Estrategias")]}>
          {(pl.vision || pl.mision) && <p className="mb-2 rounded-lg bg-[#fbfaf7] px-4 py-3 text-sm">{pl.vision && <><strong>Visión:</strong> {pl.vision.texto}<br /></>}{pl.mision && <><strong>Misión:</strong> {pl.mision.texto}</>}</p>}
          <CiteText text={r.objetivos_estrategias} refs={refs} />
          {!!pl.objetivos_estrategicos?.length && <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm">{pl.objetivos_estrategicos.map((o, i) => <li key={i}>{o.objetivo} <span className="text-soft">({o.perspectiva}, {o.plazo})</span></li>)}</ul>}
        </Sec>
        <Sec id={sid(4)} n="4." title="Sistemas y tecnologías digitales" links={[link("std", "Matriz estrategia – S/TD")]}>
          <CiteText text={r.tecnologias} refs={refs} />
          <T head={["ID", "Estrategia", "Objetivo", "S/TD", "Situación", "Aporte esperado"]} rows={pl.std.filas.map((f) => [<strong key="i">{f.id}</strong>, f.estrategia, f.objetivo, f.std, f.situacion, f.aporte])} />
        </Sec>
        <Sec id={sid(5)} n="5." title="Priorización (principio de Pareto)" links={[link("pareto", "Gráfico de Pareto")]}>
          <CiteText text={r.priorizacion} refs={refs} />
          <T head={["#", "Estrategia · S/TD", "Puntaje", "% aporte", "% acumulado", "Clase"]} rows={pr.rows.map((x, i) => [i + 1, `${x.id} · ${x.estrategia} (${x.std})`, x.score.toFixed(2), x.share.toFixed(1), x.cum.toFixed(1), <strong key="c">{x.clase}</strong>])} />
          <p className="mt-2 text-xs text-soft">{pr.mensaje}</p>
        </Sec>
        <Sec id={sid(6)} n="6." title="Indicadores de gestión" links={[link("kpis", "Fichas de KPI")]}>
          <CiteText text={r.indicadores} refs={refs} />
          <T head={["Estrategia", "Indicador", "Fórmula", "Línea base", "Meta", "Frecuencia", "Responsable"]} rows={pl.kpis.indicadores.map((k) => [k.estrategia_id, k.nombre, k.formula, k.linea_base, k.meta, k.frecuencia, k.responsable])} />
          {cov.pendientes > 0 && <p className="mt-2 text-xs text-warn">{cov.pendientes} indicador(es) con línea base pendiente de determinación: sus metas son provisionales.</p>}
        </Sec>
        <Sec id={sid(7)} n="7." title="Presupuesto e inversión" links={[link("presupuesto", "Estructura de costos")]}>
          <CiteText text={r.presupuesto} refs={refs} />
          <T head={["Concepto", `Monto (${cur})`]} rows={[
            ["Inversión inicial", money(b.inicial, cur)], ["Costos operativos recurrentes (anual)", money(b.recurrenteAnual, cur)],
            [<strong key="t">Total del primer año</strong>, <strong key="v">{money(b.anio1, cur)}</strong>],
            ["Presupuesto disponible", pl.presupuesto.disponible == null ? "No registrado" : money(pl.presupuesto.disponible, cur)],
            ...(b.saldo != null ? [[b.saldo >= 0 ? "Saldo" : "Financiamiento faltante", money(Math.abs(b.saldo), cur)]] : []),
            ["Parte estimada (sin precio verificable)", `${b.pctEstimado} %`],
          ]} />
          <T head={["Categoría", "Inicial", "Recurrente anual", "Total año 1"]} rows={b.porCategoria.map((g) => [g.key, money(g.inicial, cur), money(g.recurrente, cur), money(g.total, cur)])} />
        </Sec>
        <Sec id={sid(8)} n="8." title="Responsables">
          <T head={["Rol", "Responsabilidad", "Estrategias"]} rows={r.responsables.map((x) => [<strong key="r">{x.rol}</strong>, x.responsabilidad, x.estrategias.join(", ")])} />
        </Sec>
        <Sec id={sid(9)} n="9." title="Mecanismos de seguimiento">
          <T head={["Mecanismo", "Frecuencia", "Responsable", "Instrumento"]} rows={r.seguimiento.map((x) => [x.mecanismo, x.frecuencia, x.responsable, x.instrumento])} />
        </Sec>
        <Sec id={sid(10)} n="10." title="Conclusiones y recomendaciones">
          <div className="grid gap-4 md:grid-cols-2">
            <div><p className="label">Conclusiones</p><ol className="list-decimal space-y-1 pl-5 text-sm">{r.conclusiones.map((c, i) => <li key={i}><CiteText text={c} refs={refs} /></li>)}</ol></div>
            <div><p className="label">Recomendaciones</p><ol className="list-decimal space-y-1 pl-5 text-sm">{r.recomendaciones.map((c, i) => <li key={i}><CiteText text={c} refs={refs} /></li>)}</ol></div>
          </div>
        </Sec>
        <Sec id={sid(11)} title="Referencias"><RefList refs={refs} anchor={false} /></Sec>
      </Shell>
    </div>
  );
}

export function TdExecutiveReportTool(p: TdProps & { print?: boolean }) {
  const { result, subject } = p;
  const pl = result.plan, r = pl.informe_ejecutivo_td;
  const refs = useRefs(result);
  if (!r || !pl.std || !pl.pareto || !pl.presupuesto || !pl.kpis) return null;
  const pr = computePareto(pl.pareto, pl.std), b = computeBudget(pl.presupuesto), cur = pl.presupuesto.moneda;
  const a = pr.rows.filter((x) => x.clase === "A");
  const tiles: [string, string][] = [
    ["Inversión año 1", money(b.anio1, cur)], ["Tecnologías prioritarias", `${a.length} de ${pr.rows.length}`], ["Indicadores", String(pl.kpis.indicadores.length)],
    pl.brechas ? ["Alineamiento digital", `${gapIndex(pl.brechas).indice} %`] : ["Parte estimada", `${b.pctEstimado} %`],
  ];
  const docId = p.print ? "print-iet" : "doc-iet";
  const list = (title: string, items: string[]) => <Sec title={title}><ol className="list-decimal space-y-1 pl-5 text-sm">{items.map((x, i) => <li key={i}><CiteText text={x} refs={refs} /></li>)}</ol></Sec>;
  return (
    <div>
      {!p.print && <TdBar k="informe_ejecutivo_td" p={p} exports={[{ label: "Word", run: () => downloadWord(docId, `informe-ejecutivo-${subject}`, "Informe ejecutivo") }]} />}
      <Shell id={docId} kind="Informe ejecutivo" subject={subject}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{tiles.map(([k, v]) => <div key={k} className="rounded-xl bg-[#fbfaf7] p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-soft">{k}</p><p className="display text-xl font-bold">{v}</p></div>)}</div>
        <Sec title="Situación de la organización"><CiteText text={r.situacion} refs={refs} /></Sec>
        {list("Principales hallazgos", r.hallazgos)}
        <section className="rounded-xl border-l-4 border-brand bg-[#eef7f5] px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-dark">Decisiones estratégicas recomendadas</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5 font-semibold">{r.decisiones.map((x, i) => <li key={i}><CiteText text={x} refs={refs} /></li>)}</ol>
        </section>
        <Sec title="Tecnologías prioritarias">
          <ul className="space-y-1 text-sm">{a.map((x) => <li key={x.id} className="flex gap-2"><span className="rounded bg-brand px-1.5 py-0.5 text-[10px] font-bold text-white">{x.id}</span><span><strong>{x.std}</strong> — {x.estrategia} <span className="text-soft">({x.share.toFixed(1)} % del aporte)</span></span></li>)}</ul>
          {r.tecnologias_prioritarias.length > 0 && <ul className="mt-2 list-disc pl-5 text-sm text-soft">{r.tecnologias_prioritarias.map((x, i) => <li key={i}>{x}</li>)}</ul>}
        </Sec>
        <Sec title="Inversión requerida"><CiteText text={r.inversion} refs={refs} />
          <p className="mt-2 text-xs text-soft">Totales calculados: inicial {money(b.inicial, cur)} · recurrente anual {money(b.recurrenteAnual, cur)} · año 1 {money(b.anio1, cur)}{b.pctEstimado ? ` · ${b.pctEstimado} % estimado, no cotizado` : ""}.</p></Sec>
        <div className="grid gap-6 md:grid-cols-2">{list("Resultados esperados", r.resultados_esperados)}{list("Próximos pasos", r.proximos_pasos)}</div>
        <p className="no-print flex flex-wrap gap-2 border-t border-line pt-4">
          <ToolLink k="informe_gestion_td" label="Informe de gestión integrado" /><ToolLink k="pareto" label="Priorización" /><ToolLink k="presupuesto" label="Presupuesto" />
        </p>
      </Shell>
    </div>
  );
}

// ---------------- Documentos del diagnóstico de brechas ----------------
type DocView = { id: number; role: "institucional" | "referencia"; name: string; url: string | null; kind: string; chars: number };
export function GapDocs({ id, live, hasMainDoc, mainDoc, country }: { id: number; live: boolean; hasMainDoc: boolean; mainDoc?: string | null; country?: string | null }) {
  const [docs, setDocs] = useState<DocView[] | null>(null);
  const [role, setRole] = useState<"institucional" | "referencia">("referencia");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { fetch(`/api/strategy/${id}/documents`).then((r) => r.json()).then((j) => setDocs(j.documents ?? [])).catch(() => setDocs([])); }, [id]);
  const peru = /per[uú]/i.test(country || "");
  async function add() {
    setBusy(true); setErr("");
    const fd = new FormData();
    fd.set("role", role); fd.set("name", name); fd.set("url", url);
    if (file) fd.set("file", file);
    const r = await fetch(`/api/strategy/${id}/documents`, { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(j.error || "No se pudo agregar"); return; }
    setDocs(j.documents); setName(""); setUrl(""); setFile(null);
  }
  async function remove(doc: number) {
    const r = await fetch(`/api/strategy/${id}/documents?doc=${doc}`, { method: "DELETE" });
    const j = await r.json().catch(() => ({}));
    if (r.ok) setDocs(j.documents); else setErr(j.error || "No se pudo quitar");
  }
  const preset = (n: string) => { setRole("referencia"); setName(n); };
  return (
    <div className="card mt-4 p-5 text-left">
      <p className="font-semibold">Documentos para el diagnóstico</p>
      <p className="text-xs text-soft">Sube el plan institucional (p. ej. el Plan Estratégico Institucional) y la política o marco de referencia (p. ej. la Política Nacional de Transformación Digital al 2030). Si solo indicas el nombre o la URL oficial del marco, el agente lo busca y lo lee en la web.</p>
      <ul className="mt-3 space-y-1.5 text-sm">
        {hasMainDoc && !docs?.some((d) => d.role === "institucional") && <li className="flex items-center gap-2 rounded-lg bg-[#fbfaf7] px-3 py-1.5"><span className="rounded bg-ink px-1.5 py-0.5 text-[10px] font-bold text-white">Institucional</span>{mainDoc ?? "Documento del análisis"} <span className="text-xs text-soft">(el que subiste al crear el análisis)</span></li>}
        {docs?.map((d) => (
          <li key={d.id} className="flex items-center gap-2 rounded-lg bg-[#fbfaf7] px-3 py-1.5">
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${d.role === "institucional" ? "bg-ink text-white" : "bg-brand text-white"}`}>{d.role === "institucional" ? "Institucional" : "Referencia"}</span>
            <span className="min-w-0 flex-1 truncate">{d.name}</span>
            <span className="text-xs text-soft">{d.kind === "pdf" ? "PDF" : d.kind === "texto" ? `${Math.round(d.chars / 1000)} mil caracteres` : d.kind === "enlace" ? "enlace" : "se buscará en la web"}</span>
            {!live && <button type="button" onClick={() => remove(d.id)} className="text-soft hover:text-bad" title="Quitar"><Icon name="x" className="h-4 w-4" /></button>}
          </li>
        ))}
        {docs && !docs.some((d) => d.role === "referencia") && <li className="text-xs text-warn">Sin documento de referencia: el agente usará {peru ? "la Política Nacional de Transformación Digital al 2030" : "la política nacional de transformación digital vigente"} buscándola en su fuente oficial.</li>}
      </ul>
      {!live && (
        <div className="mt-3 grid gap-2 sm:grid-cols-[9rem_1fr_1fr_auto]">
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as typeof role)}><option value="referencia">Referencia</option><option value="institucional">Institucional</option></select>
          <input className="input" placeholder="Nombre (p. ej. PEI 2024-2030 de la UNASAM)" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input" placeholder="URL oficial (opcional)" value={url} onChange={(e) => setUrl(e.target.value)} />
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => ref.current?.click()}><Icon name="file" className="h-4 w-4" />{file ? file.name.slice(0, 14) : "Archivo"}</button>
            <button type="button" className="btn btn-primary" disabled={busy || (!name && !file)} onClick={add}>{busy ? <Spinner /> : "Agregar"}</button>
          </div>
          <input ref={ref} type="file" hidden accept=".pdf,.txt,.md,.csv,.html,.htm,application/pdf,text/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
      )}
      {!live && peru && <div className="mt-2 flex flex-wrap gap-1.5 text-xs"><span className="text-soft">Atajos:</span>
        <button type="button" className="rounded-full border border-line px-2 py-0.5 font-semibold text-brand hover:border-brand" onClick={() => preset("Política Nacional de Transformación Digital al 2030")}>Política Nacional de Transformación Digital al 2030</button>
      </div>}
      {err && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 text-sm text-bad">{err}</motion.p>}
    </div>
  );
}

/** Leyenda corta de los niveles de correspondencia (se reutiliza en la ayuda del diagnóstico). */
export const AlignHelp = () => <p className="text-xs text-soft">Niveles: {([0, 1, 2, 3] as const).map((n) => `${n} = ${ALIGN_LABEL[n].toLowerCase()}`).join(" · ")}.</p>;
