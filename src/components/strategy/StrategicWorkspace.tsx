"use client";
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { GROUPS, MODULES, PHASES, isModuleKey, moduleDef, moduleDone, type ModuleKey } from "@/lib/strategy-modules";
import type { LogRow, StrategicResult } from "@/lib/types";
import { STRATEGIC_STEPS } from "@/components/AnalysisClient";
import { TheoryLine } from "./cite";
import { Icon } from "./icons";
import { CountUp, Skeleton, Spinner } from "./motion-kit";
import {
  AnsoffTool, BcgTool, CanvasTool, EvidenceTool, FodaTool, IdentityTool, MpcTool, PestelTool, PorterTool, StrategiesTool, SummaryTool, ValueChainTool, type ToolProps,
} from "./tools";
import { DirectionTool, ExecutiveReportTool, ManagementReportTool, ReferencesTool } from "./reports";
import { BudgetTool, DigitalTool, GapsTool, KpiTool, ParetoTool, ResearchTool, StdTool } from "./td-tools";
import { GapDocs, TdExecutiveReportTool, TdManagementReportTool } from "./td-reports";
import type { TdProps } from "./td-kit";
import { computeBudget, computePareto, gapIndex, literatureStats, money } from "@/lib/td";

type View = ModuleKey | "resumen" | "evidencia" | "referencias";
const EXTRA_VIEWS = ["resumen", "evidencia", "referencias"] as const;
const isView = (h: string): h is View => isModuleKey(h) || (EXTRA_VIEWS as readonly string[]).includes(h);
const EXTRA_DEF: Record<(typeof EXTRA_VIEWS)[number], { label: string; desc: string; icon: string }> = {
  resumen: { label: "Resumen y perfil", desc: "Diagnóstico general y perfil de la organización según la investigación.", icon: "summary" },
  evidencia: { label: "Evidencia de la investigación", desc: "Datos, competidores y fuentes que usó el agente.", icon: "evidence" },
  referencias: { label: "Referencias (APA 7)", desc: "Fuentes consultadas y marco teórico, citadas en el reporte.", icon: "book" },
};

type ModState = "done" | "running" | "pending" | "missing" | "off";

const TOOL: Record<ModuleKey, ComponentType<ToolProps>> = {
  identidad: IdentityTool, canvas: CanvasTool, cadena_valor: ValueChainTool, pestel: PestelTool, porter: PorterTool,
  mpc: MpcTool, foda: FodaTool, bcg: BcgTool, direccion: DirectionTool, ansoff: AnsoffTool, estrategias: StrategiesTool,
  informe_gestion: ManagementReportTool, informe_ejecutivo: ExecutiveReportTool,
  // Fase III
  std: StdTool, pareto: ParetoTool, presupuesto: BudgetTool, kpis: KpiTool, investigacion: ResearchTool,
  brechas: GapsTool, estrategias_td: DigitalTool, informe_gestion_td: TdManagementReportTool, informe_ejecutivo_td: TdExecutiveReportTool,
};
/** Informes que se pueden imprimir por separado (cada uno tiene su contenedor print-<clave>). */
const PRINTABLE = ["informe_gestion", "informe_ejecutivo", "informe_gestion_td", "informe_ejecutivo_td"];
const ANSOFF_LABEL: Record<string, string> = { penetracion: "Penetración", desarrollo_mercado: "Desarrollo de mercado", desarrollo_producto: "Desarrollo de producto", diversificacion: "Diversificación" };

export function StrategicWorkspace({ id, subject, initialStatus, initialResult, initialModules, initialLogs, initialError, docName, country }: {
  id: number; subject: string; initialStatus: string; initialResult: StrategicResult | null;
  initialModules: ModuleKey[]; initialLogs: LogRow[]; initialError: string | null;
  /** Documento subido al crear el análisis (sirve como documento institucional en el diagnóstico de brechas). */
  docName?: string | null; country?: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [result, setResult] = useState(initialResult);
  const [modules, setModules] = useState(initialModules);
  const [logs, setLogs] = useState(initialLogs);
  const [error, setError] = useState(initialError);
  const [view, setView] = useState<View>("resumen");
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [picker, setPicker] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; key: ModuleKey }[]>([]);
  const [busy, setBusy] = useState(false);
  const live = status === "queued" || status === "running";
  const last = useRef(initialLogs.at(-1)?.id ?? 0);
  const rv = useRef(initialResult ? JSON.stringify(initialResult).length : -1);
  const doneRef = useRef(new Set(MODULES.filter((m) => moduleDone(m.key, initialResult)).map((m) => m.key)));

  // Enlaces directos: #<herramienta> abre esa vista y #ref-… abre las referencias; otros anclajes (índices de informes) se dejan al navegador.
  useEffect(() => {
    const apply = () => {
      const h = decodeURIComponent(location.hash.slice(1));
      if (h.startsWith("ref-")) { setView("referencias"); return; } // ReferencesTool se desplaza hasta la referencia
      if (!isView(h)) return;
      setView(h);
      document.getElementById("workspace-top")?.scrollIntoView({ block: "start", behavior: "smooth" });
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  useEffect(() => {
    if (!live) return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/strategy/${id}?after=${last.current}&rv=${rv.current}`, { cache: "no-store" });
        if (!r.ok || stop) return;
        const j = await r.json();
        if (j.logs.length) { last.current = j.logs.at(-1).id; setLogs((p) => [...p, ...j.logs]); }
        if (j.result) {
          rv.current = j.rv;
          setResult(j.result);
          for (const m of MODULES) if (moduleDone(m.key, j.result) && !doneRef.current.has(m.key)) {
            doneRef.current.add(m.key);
            const tid = Date.now() + Math.random();
            setToasts((t) => [...t, { id: tid, key: m.key }]);
            setTimeout(() => setToasts((t) => t.filter((x) => x.id !== tid)), 4500);
          }
        }
        setModules(j.modules); setStatus(j.status); setError(j.error);
        if (j.status === "completed" || j.status === "failed") { stop = true; router.refresh(); }
      } catch { /* reintenta en el siguiente tick */ }
    };
    const iv = setInterval(tick, 2000);
    tick();
    return () => { stop = true; clearInterval(iv); };
  }, [live, id, router]);

  const stateOf = (k: ModuleKey): ModState => {
    if (moduleDone(k, result)) return "done";
    if (!modules.includes(k)) return "off";
    if (live) return result?.running?.includes(k) ? "running" : "pending";
    return "missing";
  };
  const selected = modules.length;
  const doneCount = modules.filter((k) => moduleDone(k, result)).length;

  async function generate(keys: ModuleKey[]) {
    setBusy(true);
    const r = await fetch(`/api/strategy/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ modules: keys }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { alert(j.error || "No se pudo iniciar"); return; }
    setModules(j.modules); setStatus("queued"); setError(null); setPicker(false);
  }

  if (!result) return <ResearchStage status={status} logs={logs} error={error} onRetry={() => generate([])} busy={busy} modules={modules} />;

  const views: { key: View; label: string; icon: string }[] = [{ key: "resumen", label: "Resumen y perfil", icon: "summary" }];
  const Active = view === "resumen" ? SummaryTool : view === "evidencia" ? EvidenceTool : view === "referencias" ? ReferencesTool : TOOL[view];
  const extra = (EXTRA_VIEWS as readonly string[]).includes(view);
  const props: ToolProps & TdProps = {
    result, subject, id, live, onResult: setResult,
    onQueued: (m) => { setModules(m); setStatus("queued"); setError(null); },
  };
  const gapDocs = <GapDocs id={id} live={live} hasMainDoc={!!docName} mainDoc={docName} country={country} />;

  return (
    <MotionConfig reducedMotion="user">
      <div className="no-print">
        <AnimatePresence>{(live || status === "failed") && (
          <LiveBanner key="banner" live={live} status={status} error={error} done={doneCount} total={selected} result={result}
            consoleOpen={consoleOpen} onConsole={() => setConsoleOpen(!consoleOpen)} onRetry={() => generate([])} busy={busy} />
        )}</AnimatePresence>
        <AnimatePresence>{consoleOpen && <Console key="console" logs={logs} />}</AnimatePresence>

        <Panorama result={result} subject={subject} />

        <div id="workspace-top" className="mt-6 grid scroll-mt-4 gap-5 lg:grid-cols-[15.5rem_minmax(0,1fr)]">
          <nav className="min-w-0 lg:sticky lg:top-4 lg:self-start">
            <LayoutGroup id="nav">
              <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0">
                {views.map((v) => <NavItem key={v.key} href={v.key} label={v.label} icon={v.icon} active={view === v.key} state="done" />)}
                {PHASES.map((ph) => (
                  <div key={ph.key} className="contents lg:block">
                    <p className="mt-4 hidden border-t border-line px-3 pt-3 text-[11px] font-bold text-ink lg:block">{ph.label}</p>
                    {GROUPS.filter((g) => ph.groups.includes(g.key)).map((g) => (
                      <div key={g.key} className="contents lg:block">
                        <p className="mt-2 hidden px-3 text-[10px] font-bold uppercase tracking-widest text-soft lg:block">{g.label}</p>
                        {MODULES.filter((m) => m.group === g.key).map((m) => (
                          <NavItem key={m.key} href={m.key} label={m.label} icon={m.icon} active={view === m.key} state={stateOf(m.key)} />
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
                <p className="mt-4 hidden border-t border-line px-3 pt-3 text-[11px] font-bold text-ink lg:block">Fuentes</p>
                <NavItem href="evidencia" label="Evidencia" icon="evidence" active={view === "evidencia"} state="done" />
                <NavItem href="referencias" label="Referencias APA" icon="book" active={view === "referencias"} state="done" />
              </div>
            </LayoutGroup>
            {!live && MODULES.some((m) => stateOf(m.key) === "off" || stateOf(m.key) === "missing") && (
              <button onClick={() => setPicker(true)} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-brand/50 px-3 py-2.5 text-sm font-semibold text-brand hover:bg-[#eef7f5]">
                <Icon name="plus" className="h-4 w-4" />Agregar herramientas
              </button>
            )}
          </nav>

          <div className="min-w-0">
            <AnimatePresence mode="wait">
              <motion.section key={view} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.22 }}>
                <PanelHeader view={view} state={extra ? "done" : stateOf(view as ModuleKey)} />
                {extra || stateOf(view as ModuleKey) === "done"
                  ? (view === "brechas" ? <GapsTool {...props} docsSlot={gapDocs} /> : <Active {...props} />)
                  : <PendingPanel k={view as ModuleKey} state={stateOf(view as ModuleKey)} busy={busy} live={live} onGenerate={() => generate([view as ModuleKey])}
                      extra={view === "brechas" && stateOf("brechas") !== "running" ? gapDocs : undefined} />}
              </motion.section>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Versión imprimible: todas las herramientas generadas, una tras otra (o solo un informe, ver PanelHeader). */}
      <div className="print-all hidden space-y-8 print:block">
        <SummaryTool {...props} />
        {PHASES.map((ph) => (
          <div key={ph.key} className="space-y-8">
            <h2 className="display border-b border-line pb-1 text-2xl font-bold">{ph.label}</h2>
            {MODULES.filter((m) => ph.groups.includes(m.group) && moduleDone(m.key, result)).map((m) => { const T = TOOL[m.key]; return (
              <section key={m.key} className="break-inside-avoid"><h2 className="display mb-3 text-xl font-bold">{m.label}</h2><T {...props} /></section>
            ); })}
          </div>
        ))}
        <section><h2 className="display mb-3 text-xl font-bold">Evidencia</h2><EvidenceTool {...props} /></section>
        <section><h2 className="display mb-3 text-xl font-bold">Referencias</h2><ReferencesTool {...props} anchor={false} /></section>
      </div>
      {moduleDone("informe_gestion", result) && <div className="print-informe_gestion hidden"><ManagementReportTool {...props} print /></div>}
      {moduleDone("informe_ejecutivo", result) && <div className="print-informe_ejecutivo hidden"><ExecutiveReportTool {...props} /></div>}
      {moduleDone("informe_gestion_td", result) && <div className="print-informe_gestion_td hidden"><TdManagementReportTool result={result} subject={subject} print /></div>}
      {moduleDone("informe_ejecutivo_td", result) && <div className="print-informe_ejecutivo_td hidden"><TdExecutiveReportTool result={result} subject={subject} print /></div>}

      <AnimatePresence>{picker && <Picker key="picker" options={MODULES.filter((m) => ["off", "missing"].includes(stateOf(m.key))).map((m) => m.key)} busy={busy} onClose={() => setPicker(false)} onGenerate={generate} />}</AnimatePresence>
      <div className="no-print pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col gap-2">
        <AnimatePresence>{toasts.map((t) => (
          <motion.div key={t.id} layout initial={{ opacity: 0, x: 40, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 40 }}
            className="pointer-events-auto flex items-center gap-3 rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-xl">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-good"><Icon name="check" className="h-4 w-4" /></span>
            <span><strong>{moduleDef(t.key).label}</strong> listo</span>
            <a className="font-semibold text-[#7dd3c0] hover:underline" href={`#${t.key}`}>Ver</a>
          </motion.div>
        ))}</AnimatePresence>
      </div>
    </MotionConfig>
  );
}

function NavItem({ href, label, icon, active, state }: { href: View; label: string; icon: string; active: boolean; state: ModState }) {
  return (
    <a href={`#${href}`} aria-current={active ? "page" : undefined}
      className={`relative flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-left lg:w-full text-sm transition-colors ${active ? "text-white" : state === "off" ? "text-soft/70 hover:text-ink" : "text-ink hover:bg-white"}`}>
      {active && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-xl bg-ink shadow-md" transition={{ type: "spring", stiffness: 380, damping: 30 }} />}
      <Icon name={icon} className="relative h-4 w-4 shrink-0" />
      <span className="relative flex-1 whitespace-nowrap font-medium lg:whitespace-normal">{label}</span>
      <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
        {state === "done" && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className={`h-2 w-2 rounded-full ${active ? "bg-[#7dd3c0]" : "bg-good"}`} />}
        {state === "running" && <Spinner className="h-3.5 w-3.5 text-accent" />}
        {state === "pending" && <Icon name="clock" className="h-3.5 w-3.5 opacity-60" />}
        {state === "missing" && <span className="text-xs font-bold text-bad">!</span>}
        {state === "off" && <Icon name="plus" className="h-3.5 w-3.5 opacity-50" />}
      </span>
    </a>
  );
}

function PanelHeader({ view, state }: { view: View; state: ModState }) {
  const def = isModuleKey(view) ? moduleDef(view) : EXTRA_DEF[view];
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(`${location.origin}${location.pathname}#${view}`); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* sin permiso de portapapeles */ }
  };
  /** Imprime solo este informe: globals.css oculta el resto mientras body tenga data-print. */
  const printReport = () => {
    document.body.dataset.print = view;
    window.addEventListener("afterprint", () => { delete document.body.dataset.print; }, { once: true });
    window.print();
  };
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <motion.span initial={{ rotate: -20, scale: 0.6 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 15 }}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${state === "done" ? "bg-brand text-white" : "bg-[#ece9e0] text-soft"}`}>
        <Icon name={def.icon} className="h-5 w-5" />
      </motion.span>
      <div className="min-w-0 flex-1">
        <h2 className="display text-2xl font-bold leading-tight">{def.label}</h2>
        <p className="text-sm text-soft">{def.desc}</p>
        {isModuleKey(view) && <TheoryLine k={view} />}
      </div>
      <div className="flex gap-1.5">
        {state === "done" && PRINTABLE.includes(view) && (
          <button type="button" onClick={printReport} className="btn btn-ghost !px-3 !py-1.5 text-xs"><Icon name="file" className="h-4 w-4" />Imprimir / PDF</button>
        )}
        <button type="button" onClick={copy} title="Copiar el enlace directo a esta sección" className="btn btn-ghost !px-3 !py-1.5 text-xs">
          <Icon name={copied ? "check" : "link"} className="h-4 w-4" />{copied ? "Copiado" : "Copiar enlace"}
        </button>
      </div>
    </div>
  );
}

function PendingPanel({ k, state, busy, live, onGenerate, extra }: { k: ModuleKey; state: ModState; busy: boolean; live: boolean; onGenerate: () => void; extra?: React.ReactNode }) {
  const def = moduleDef(k);
  if (state === "running") return (
    <div>
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-accent"><Spinner />El agente está generando esta herramienta…</p>
      <Skeleton />
    </div>
  );
  if (state === "pending") return (
    <div className="card flex items-center gap-4 p-6">
      <motion.span animate={{ rotate: [0, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 2.5 }}><Icon name="clock" className="h-8 w-8 text-soft" /></motion.span>
      <div><p className="font-semibold">En cola</p><p className="text-sm text-soft">Se generará cuando terminen los pasos anteriores; aparecerá aquí automáticamente.</p></div>
    </div>
  );
  return (
    <motion.div className="card relative overflow-hidden p-8 text-center" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
      <motion.div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#eef7f5] text-brand" animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 3 }}>
        <Icon name={def.icon} className="h-8 w-8" />
      </motion.div>
      <h3 className="display mt-4 text-xl font-bold">{state === "missing" ? "Esta herramienta no llegó a generarse" : "Aún no incluiste esta herramienta"}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-soft">{def.desc} El agente reutiliza la investigación y lo ya generado, así que toma menos tiempo.</p>
      {def.requires?.length ? <p className="mt-2 text-xs text-soft">Incluye también: {def.requires.map((r) => moduleDef(r).label).join(", ")}.</p> : null}
      <button className="btn btn-primary mt-5" disabled={busy || live} onClick={onGenerate}>
        {busy ? <Spinner /> : <Icon name="sparkle" className="h-4 w-4" />}Generar {def.label}
      </button>
      {live && <p className="mt-2 text-xs text-soft">Espera a que termine el trabajo en curso.</p>}
      {extra}
    </motion.div>
  );
}

function Panorama({ result, subject }: { result: StrategicResult; subject: string }) {
  const p = result.plan;
  const tiles = useMemo(() => {
    const t: { key: string; view: View; label: string; value: React.ReactNode; hint: string; tone?: string }[] = [];
    if (result.efiTotal != null) t.push({ key: "efi", view: "foda", label: "EFI", value: <CountUp value={result.efiTotal} decimals={2} />, hint: result.efiTotal >= 2.5 ? "Posición interna fuerte" : "Posición interna débil", tone: result.efiTotal >= 2.5 ? "text-good" : "text-bad" });
    if (result.efeTotal != null) t.push({ key: "efe", view: "foda", label: "EFE", value: <CountUp value={result.efeTotal} decimals={2} />, hint: result.efeTotal >= 2.5 ? "Responde bien al entorno" : "Responde débil al entorno", tone: result.efeTotal >= 2.5 ? "text-good" : "text-bad" });
    if (result.ie) t.push({ key: "ie", view: "foda", label: "Matriz IE", value: <>Cuadrante {["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"][result.ie.cuadrante - 1]}</>, hint: result.ie.estrategia });
    if (p.porter) {
      const fs = [p.porter.rivalidad, p.porter.nuevos_entrantes, p.porter.sustitutos, p.porter.poder_proveedores, p.porter.poder_clientes];
      const avg = fs.reduce((s, f) => s + (Number(f.puntaje) || 0), 0) / 5;
      t.push({ key: "porter", view: "porter", label: "Presión del sector", value: <><CountUp value={avg} decimals={1} /><span className="text-base text-soft">/5</span></>, hint: avg >= 3.5 ? "Sector poco atractivo" : avg >= 2.5 ? "Atractivo moderado" : "Sector atractivo", tone: avg >= 3.5 ? "text-bad" : avg >= 2.5 ? "text-warn" : "text-good" });
    }
    if (result.mpcTotals?.length) {
      const sorted = [...result.mpcTotals].sort((a, b) => b.total - a.total);
      const pos = sorted.findIndex((x) => x.empresa.toLowerCase() === subject.toLowerCase());
      if (pos >= 0) t.push({ key: "mpc", view: "mpc", label: "Perfil competitivo", value: <>#{pos + 1}<span className="text-base text-soft"> de {sorted.length}</span></>, hint: `Total ${sorted[pos].total.toFixed(2)}`, tone: pos === 0 ? "text-good" : undefined });
    }
    if (p.pestel) { const o = p.pestel.filter((x) => x.efecto === "oportunidad").length; t.push({ key: "pestel", view: "pestel", label: "PESTEL", value: <><CountUp value={o} /><span className="text-base text-soft"> / {p.pestel.length}</span></>, hint: "factores son oportunidades" }); }
    if (p.direccion) t.push({ key: "dir", view: "direccion", label: "Estrategia general", value: <span className="text-xl">{p.direccion.estrategia_general.tipo}</span>, hint: p.direccion.estrategia_competitiva.tipo });
    if (p.ansoff) t.push({ key: "ansoff", view: "ansoff", label: "Crecimiento", value: <span className="text-xl">{ANSOFF_LABEL[p.ansoff.recomendada]}</span>, hint: "Opción Ansoff recomendada" });
    if (p.bcg) t.push({ key: "bcg", view: "bcg", label: "Portafolio BCG", value: <><CountUp value={p.bcg.unidades.filter((u) => u.cuadrante === "estrella").length} /><span className="text-base text-soft"> ★</span></>, hint: `${p.bcg.unidades.length} líneas evaluadas` });
    if (p.estrategias) t.push({ key: "estr", view: "estrategias", label: "Plan", value: <CountUp value={p.estrategias.length} />, hint: "estrategias con KPI" });
    // Fase III
    if (p.std) t.push({ key: "std", view: "std", label: "S/TD", value: <CountUp value={p.std.filas.length} />, hint: `${p.std.filas.filter((f) => f.situacion === "nueva").length} tecnologías nuevas` });
    if (p.pareto && p.std) { const pr = computePareto(p.pareto, p.std); t.push({ key: "pareto", view: "pareto", label: "Prioridad A", value: <>{pr.rows.filter((r) => r.clase === "A").length}<span className="text-base text-soft"> de {pr.rows.length}</span></>, hint: pr.cumple ? "Se aproxima a 80/20" : "No sigue 80/20" }); }
    if (p.presupuesto) { const b = computeBudget(p.presupuesto); t.push({ key: "pres", view: "presupuesto", label: "Inversión año 1", value: <span className="text-xl">{money(b.anio1, p.presupuesto.moneda)}</span>, hint: `${b.pctEstimado} % estimado` }); }
    if (p.kpis) t.push({ key: "kpis", view: "kpis", label: "KPI", value: <CountUp value={p.kpis.indicadores.length} />, hint: `${p.kpis.indicadores.filter((k) => k.linea_base_estado === "pendiente").length} con línea base pendiente` });
    if (p.brechas) { const g = gapIndex(p.brechas); t.push({ key: "gap", view: "brechas", label: "Alineamiento digital", value: <><CountUp value={g.indice} />%</>, hint: `${g.criticas} brechas críticas`, tone: g.indice >= 67 ? "text-good" : g.indice >= 34 ? "text-warn" : "text-bad" }); }
    if (p.literatura) { const l = literatureStats(p.literatura); t.push({ key: "lit", view: "investigacion", label: "Literatura", value: <CountUp value={l.total} />, hint: `${l.consultadas} consultadas` }); }
    t.push({ key: "src", view: "evidencia", label: "Evidencia", value: <CountUp value={result.research.fuentes.length} />, hint: `fuentes · ${result.research.competidores.length} competidores` });
    return t;
  }, [result, p, subject]);
  return (
    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      <AnimatePresence>{tiles.map((t, i) => (
        <motion.a href={`#${t.view}`} key={t.key} layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, type: "spring", stiffness: 260, damping: 24 }}
          whileHover={{ y: -3, boxShadow: "0 8px 24px -12px rgb(18 32 58 / 0.25)" }} className="card p-3.5 text-left">
          <p className="text-[10px] font-bold uppercase tracking-wider text-soft">{t.label}</p>
          <p className={`display mt-1 text-2xl font-bold leading-tight ${t.tone ?? ""}`}>{t.value}</p>
          <p className="mt-0.5 text-xs text-soft">{t.hint}</p>
        </motion.a>
      ))}</AnimatePresence>
    </div>
  );
}

function LiveBanner({ live, status, error, done, total, result, consoleOpen, onConsole, onRetry, busy }: {
  live: boolean; status: string; error: string | null; done: number; total: number; result: StrategicResult;
  consoleOpen: boolean; onConsole: () => void; onRetry: () => void; busy: boolean;
}) {
  const running = (result.running ?? []) as ModuleKey[];
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => { if (!live) return; const t = setInterval(() => setElapsed((e) => e + 1), 1000); return () => clearInterval(t); }, [live]);
  const failed = status === "failed";
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
      <div className={`card mb-4 p-4 ${failed ? "!border-red-200 !bg-red-50" : "!border-ink !bg-ink text-white"}`}>
        <div className="flex flex-wrap items-center gap-3">
          {failed ? <span className="text-xl">⚠</span> : <span className="relative flex h-3 w-3"><span className="absolute inset-0 animate-ping rounded-full bg-accent" /><span className="relative h-3 w-3 rounded-full bg-accent" /></span>}
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{failed ? "El agente no pudo terminar todas las herramientas" : status === "queued" ? "En cola, esperando turno…" : "El agente está trabajando"}</p>
            <p className={`text-sm ${failed ? "text-bad" : "text-white/70"}`}>
              {failed ? error : running.length ? <>Generando: {running.map((k) => moduleDef(k).label).join(" · ")}</> : "Preparando el siguiente paso…"}
            </p>
          </div>
          <span className={`display text-2xl font-bold tabular-nums ${failed ? "text-bad" : ""}`}>{done}/{total}</span>
          {live && <span className="font-mono text-xs text-white/60">{elapsed}s</span>}
          <button onClick={onConsole} className={`btn !px-3 !py-1.5 ${failed ? "btn-ghost" : "border-white/20 bg-white/10 text-white hover:bg-white/20"}`}><Icon name="terminal" className="h-4 w-4" />{consoleOpen ? "Ocultar registro" : "Ver registro"}</button>
          {failed && <button className="btn btn-primary !px-3 !py-1.5" disabled={busy} onClick={onRetry}>Reintentar lo que falta</button>}
        </div>
        <div className={`mt-3 h-1.5 overflow-hidden rounded-full ${failed ? "bg-red-100" : "bg-white/15"}`}>
          <motion.div className={`h-full rounded-full ${failed ? "bg-bad" : "bg-gradient-to-r from-brand to-accent"}`} animate={{ width: `${total ? Math.max(4, (done / total) * 100) : 0}%` }} transition={{ type: "spring", stiffness: 60, damping: 15 }} />
        </div>
      </div>
    </motion.div>
  );
}

function Console({ logs }: { logs: LogRow[] }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [logs.length]);
  const time = (ts: string) => new Date(ts).toLocaleTimeString("es-PE", { hour12: false, timeZone: "America/Lima" });
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
      <div className="mb-4 max-h-72 overflow-y-auto rounded-xl bg-[#0f1a2e] p-4 font-mono text-xs text-slate-300">
        <AnimatePresence initial={false}>{logs.map((l) => (
          <motion.div key={l.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="flex gap-3 py-0.5">
            <span className="shrink-0 text-slate-500">{time(l.ts)}</span>
            <span className="w-24 shrink-0 text-[#7dd3c0]">{STRATEGIC_STEPS.find((s) => s.key === l.step)?.label ?? l.step}</span>
            <span className={`whitespace-pre-wrap break-words ${l.level === "error" ? "text-red-400" : l.level === "warn" ? "text-amber-300" : l.level === "success" ? "text-emerald-300" : ""}`}>{l.message}</span>
          </motion.div>
        ))}</AnimatePresence>
        <div ref={end} />
      </div>
    </motion.div>
  );
}

/** Antes de que exista la investigación: animación de las fuentes que el agente está consultando. */
function ResearchStage({ status, logs, error, onRetry, busy, modules }: { status: string; logs: LogRow[]; error: string | null; onRetry: () => void; busy: boolean; modules: ModuleKey[] }) {
  const failed = status === "failed";
  const lastMsg = logs.filter((l) => l.level !== "error").at(-1)?.message ?? "En cola, esperando turno…";
  const orbit = ["globe", "search", "file", "building", "podium", "evidence"];
  return (
    <MotionConfig reducedMotion="user">
      <div className="card relative overflow-hidden p-8">
        <div className="grid items-center gap-8 md:grid-cols-[16rem_1fr]">
          <div className="relative mx-auto h-56 w-56">
            <motion.div className="absolute inset-0 rounded-full border border-dashed border-brand/40" animate={failed ? {} : { rotate: 360 }} transition={{ repeat: Infinity, duration: 24, ease: "linear" }}>
              {orbit.map((ic, i) => {
                const a = (i / orbit.length) * Math.PI * 2;
                return (
                  <motion.span key={ic} className="absolute flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white text-brand shadow-sm"
                    style={{ left: `calc(50% + ${Math.cos(a) * 112}px - 20px)`, top: `calc(50% + ${Math.sin(a) * 112}px - 20px)` }}
                    animate={failed ? {} : { rotate: -360, scale: [1, 1.12, 1] }} transition={{ rotate: { repeat: Infinity, duration: 24, ease: "linear" }, scale: { repeat: Infinity, duration: 2, delay: i * 0.33 } }}>
                    <Icon name={ic} className="h-5 w-5" />
                  </motion.span>
                );
              })}
            </motion.div>
            <motion.div className={`absolute inset-14 flex items-center justify-center rounded-full ${failed ? "bg-red-50 text-bad" : "bg-ink text-white"}`}
              animate={failed ? {} : { scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
              {failed ? <span className="text-4xl">⚠</span> : <Icon name="sparkle" className="h-12 w-12" />}
            </motion.div>
          </div>
          <div>
            <p className="eyebrow">{failed ? "Análisis fallido" : "Paso 1 · Investigación"}</p>
            <h2 className="display mt-1 text-2xl font-bold">{failed ? "El agente no pudo completar la investigación" : "El agente está investigando"}</h2>
            <p className="mt-2 text-sm text-soft">{failed ? error : "Visita el sitio web, busca competidores y datos del macroentorno, y lee tu documento. Luego cada herramienta aparecerá aquí apenas esté lista."}</p>
            <AnimatePresence mode="wait">
              {!failed && <motion.p key={lastMsg} className="mt-4 rounded-lg bg-[#fbfaf7] px-3 py-2 font-mono text-xs" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>› {lastMsg}</motion.p>}
            </AnimatePresence>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {modules.map((k, i) => (
                <motion.span key={k} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-xs"><Icon name={moduleDef(k).icon} className="h-3.5 w-3.5 text-soft" />{moduleDef(k).label}</motion.span>
              ))}
            </div>
            {failed && <button className="btn btn-primary mt-5" disabled={busy} onClick={onRetry}>{busy ? <Spinner /> : null}Reintentar</button>}
          </div>
        </div>
      </div>
      <div className="mt-4"><Console logs={logs} /></div>
    </MotionConfig>
  );
}

function Picker({ options, busy, onClose, onGenerate }: { options: ModuleKey[]; busy: boolean; onClose: () => void; onGenerate: (k: ModuleKey[]) => void }) {
  const [sel, setSel] = useState<ModuleKey[]>(options);
  const toggle = (k: ModuleKey) => setSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  return (
    <motion.div className="no-print fixed inset-0 z-40 flex items-end justify-center bg-ink/40 p-4 backdrop-blur-sm sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="card w-full max-w-lg p-5 shadow-2xl" initial={{ y: 40, scale: 0.96 }} animate={{ y: 0, scale: 1 }} exit={{ y: 40, scale: 0.96 }} transition={{ type: "spring", stiffness: 300, damping: 28 }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between"><div><h3 className="display text-xl font-bold">Agregar herramientas</h3><p className="text-sm text-soft">Se reutiliza la investigación; solo se generan las nuevas.</p></div>
          <button onClick={onClose} className="text-soft hover:text-ink"><Icon name="x" /></button></div>
        <div className="mt-4 space-y-1.5">
          {options.map((k) => { const d = moduleDef(k), on = sel.includes(k); return (
            <motion.button key={k} type="button" whileTap={{ scale: 0.98 }} onClick={() => toggle(k)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${on ? "border-brand bg-[#eef7f5]" : "border-line bg-white"}`}>
              <Icon name={d.icon} className={`h-5 w-5 ${on ? "text-brand" : "text-soft"}`} />
              <span className="flex-1"><span className="block text-sm font-semibold">{d.label}</span><span className="block text-xs text-soft">{d.desc}</span></span>
              <span className={`flex h-5 w-5 items-center justify-center rounded-md border ${on ? "border-brand bg-brand text-white" : "border-line"}`}>{on && <Icon name="check" className="h-3.5 w-3.5" />}</span>
            </motion.button>
          ); })}
        </div>
        <button className="btn btn-primary mt-4 w-full" disabled={busy || !sel.length} onClick={() => onGenerate(sel)}>{busy ? <Spinner /> : <Icon name="sparkle" className="h-4 w-4" />}Generar {sel.length} herramienta{sel.length === 1 ? "" : "s"}</button>
      </motion.div>
    </motion.div>
  );
}
