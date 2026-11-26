"use client";
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { GROUPS, MODULES, PHASES, PRESETS, moduleDef, normalizeModules, type ModuleKey } from "@/lib/strategy-modules";
import { STATUS_LABEL } from "@/lib/format";
import { Icon } from "./strategy/icons";
import { Spinner, item, stagger } from "./strategy/motion-kit";

type Defaults = { name: string; industry: string; country: string };
const STEPS = [{ label: "Empresa", icon: "building" }, { label: "Fuentes", icon: "file" }, { label: "Herramientas", icon: "grid" }];

/** Duración aproximada: investigación + un paso del agente por grupo de herramientas (identidad y entorno van en paralelo). */
function estimate(mods: ModuleKey[]) {
  const steps = new Set(mods.map((k) => moduleDef(k).step));
  const parallel = steps.has("identidad") && steps.has("entorno") ? 1 : 0;
  const s = 90 + (steps.size - parallel) * 45;
  return `${Math.max(2, Math.round(s / 60))}–${Math.round(s / 60) + 2} min`;
}

export function StrategyForm({ defaults }: { defaults: Defaults }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [kind, setKind] = useState<"propia" | "externa">("propia");
  const [f, setF] = useState({ name: defaults.name, websiteUrl: "", industry: defaults.industry, country: defaults.country, notes: "" });
  const [file, setFile] = useState<File | null>(null);
  // Fase III: política o marco de referencia para el diagnóstico de brechas (opcional).
  const [refFile, setRefFile] = useState<File | null>(null);
  const [refName, setRefName] = useState("");
  const refInput = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [mods, setMods] = useState<ModuleKey[]>(PRESETS[0].modules);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const go = (n: number) => { setDir(n > step ? 1 : -1); setErr(""); setStep(n); };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const pickKind = (k: "propia" | "externa") => {
    setKind(k);
    setF(k === "propia" ? { ...f, name: defaults.name, industry: defaults.industry } : { ...f, name: "", industry: "" });
  };
  const toggle = (k: ModuleKey) => {
    const on = mods.includes(k);
    // Quitar una herramienta quita las que dependen de ella; agregarla agrega sus requisitos.
    setMods(on ? mods.filter((m) => m !== k && !moduleDef(m).requires?.includes(k)) : normalizeModules([...mods, k]));
  };
  const preset = PRESETS.find((p) => p.modules.length === mods.length && p.modules.every((m) => mods.includes(m)))?.key;

  function next() {
    if (step === 0 && !f.name.trim()) { setErr("Indica el nombre de la empresa"); return; }
    if (step === 1 && kind === "externa" && !f.websiteUrl && !file && !f.notes.trim()) { setErr("Para otra empresa indica al menos su sitio web, un documento o una descripción"); return; }
    go(step + 1);
  }

  async function submit() {
    if (!mods.length) { setErr("Elige al menos una herramienta"); return; }
    setBusy(true); setErr("");
    const fd = new FormData();
    fd.set("kind", kind);
    for (const [k, v] of Object.entries(f)) fd.set(k, v);
    if (file) fd.set("file", file);
    if (refFile) fd.set("refFile", refFile);
    if (refName.trim()) fd.set("refName", refName.trim());
    fd.set("modules", JSON.stringify(mods));
    const r = await fetch("/api/strategy", { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(j.error || "No se pudo iniciar el análisis"); setBusy(false); return; }
    router.push(`/strategy/${j.id}`);
  }

  const own = kind === "propia";
  return (
    <MotionConfig reducedMotion="user">
      <div className="card overflow-hidden">
        {/* Stepper */}
        <div className="flex items-center gap-2 border-b border-line bg-[#fbfaf7] px-5 py-4">
          {STEPS.map((s, i) => (
            <div key={s.label} className="flex flex-1 items-center gap-2 last:flex-none">
              <button type="button" onClick={() => i < step && go(i)} disabled={i > step} className="flex items-center gap-2">
                <motion.span animate={{ backgroundColor: i <= step ? "var(--ink)" : "#e4e2da", color: i <= step ? "#fff" : "var(--ink-soft)", scale: i === step ? 1.1 : 1 }}
                  className="flex h-8 w-8 items-center justify-center rounded-full">
                  {i < step ? <Icon name="check" className="h-4 w-4" /> : <Icon name={s.icon} className="h-4 w-4" />}
                </motion.span>
                <span className={`hidden text-sm font-semibold sm:inline ${i === step ? "text-ink" : "text-soft"}`}>{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className="h-0.5 flex-1 overflow-hidden rounded-full bg-line">
                  <motion.div className="h-full bg-ink" animate={{ width: i < step ? "100%" : "0%" }} transition={{ duration: 0.4 }} />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="relative min-h-[22rem] p-5">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div key={step} custom={dir} initial={{ opacity: 0, x: dir * 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -40 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}>
              {step === 0 && (
                <div className="space-y-5">
                  <div><h2 className="display text-xl font-bold">¿Qué organización vas a analizar?</h2><p className="text-sm text-soft">Tu empresa aprovecha el catálogo y los análisis de precios de Compa.</p></div>
                  <LayoutGroup id="kind">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {([["propia", "Mi empresa", "Catálogo, precios y competidores de Compa + web y documento.", "building"], ["externa", "Otra empresa", "Competidor, proveedor o cualquier organización desde su web o un documento.", "search"]] as const).map(([k, t, d, ic]) => (
                        <motion.button key={k} type="button" whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} onClick={() => pickKind(k)}
                          className={`relative flex gap-3 rounded-2xl border p-4 text-left ${kind === k ? "border-ink" : "border-line bg-white"}`}>
                          {kind === k && <motion.span layoutId="kind-bg" className="absolute inset-0 rounded-2xl bg-[#eef7f5] ring-2 ring-ink" />}
                          <span className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${kind === k ? "bg-ink text-white" : "bg-[#f3f1ea] text-soft"}`}><Icon name={ic} /></span>
                          <span className="relative"><span className="block font-semibold">{t}</span><span className="block text-sm text-soft">{d}</span></span>
                        </motion.button>
                      ))}
                    </div>
                  </LayoutGroup>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div><label className="label">Empresa *</label><input className="input" value={f.name} onChange={set("name")} placeholder={own ? "" : "Ej. Hiraoka"} autoFocus /></div>
                    <div><label className="label">Sector</label><input className="input" value={f.industry} onChange={set("industry")} placeholder="Ej. Retail de tecnología" /></div>
                    <div><label className="label">País</label><input className="input" value={f.country} onChange={set("country")} /></div>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-5">
                  <div><h2 className="display text-xl font-bold">¿De dónde aprende el agente?</h2><p className="text-sm text-soft">Además buscará en la web datos del sector, competidores y el macroentorno.</p></div>
                  <div><label className="label">Sitio web</label>
                    <div className="relative"><Icon name="globe" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-soft" /><input className="input !pl-9" value={f.websiteUrl} onChange={set("websiteUrl")} placeholder="https://…" /></div></div>
                  <div>
                    <label className="label">Documento (PDF, TXT, MD, CSV o HTML · máx. 8 MB)</label>
                    <motion.div onClick={() => fileRef.current?.click()} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
                      onDrop={(e) => { e.preventDefault(); setDrag(false); const x = e.dataTransfer.files[0]; if (x) setFile(x); }}
                      animate={{ scale: drag ? 1.02 : 1, borderColor: drag ? "var(--brand)" : "var(--line)", backgroundColor: drag ? "#eef7f5" : "#fbfaf7" }}
                      className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center">
                      <AnimatePresence mode="wait">
                        {file ? (
                          <motion.div key="f" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white"><Icon name="file" /></span>
                            <span className="text-left"><span className="block text-sm font-semibold">{file.name}</span><span className="block text-xs text-soft">{(file.size / 1024).toFixed(0)} KB</span></span>
                            <button type="button" className="ml-2 text-soft hover:text-bad" onClick={(e) => { e.stopPropagation(); setFile(null); }}><Icon name="x" className="h-4 w-4" /></button>
                          </motion.div>
                        ) : (
                          <motion.div key="e" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-1">
                            <motion.span animate={{ y: drag ? -4 : [0, -3, 0] }} transition={drag ? {} : { repeat: Infinity, duration: 2.4 }}><Icon name="file" className="h-7 w-7 text-soft" /></motion.span>
                            <span className="text-sm font-semibold">Arrastra un archivo o haz clic</span>
                            <span className="text-xs text-soft">Memoria anual, plan de negocio, estados financieros…</span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                    <input ref={fileRef} type="file" hidden accept=".pdf,.txt,.md,.markdown,.csv,.json,.html,.htm,application/pdf,text/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                  </div>
                  <details className="rounded-2xl border border-line bg-white p-4" open={!!refFile || !!refName}>
                    <summary className="cursor-pointer text-sm font-semibold">Documento de referencia para el diagnóstico de brechas <span className="font-normal text-soft">(opcional · fase III)</span></summary>
                    <p className="mt-1 text-xs text-soft">Política, estrategia o marco con el que se comparará el plan institucional; por ejemplo, la Política Nacional de Transformación Digital al 2030. Si solo pones el nombre, el agente la busca en su fuente oficial. También puedes agregarlo después en el reporte.</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                      <input className="input" value={refName} onChange={(e) => setRefName(e.target.value)} placeholder="Nombre del documento de referencia" />
                      <button type="button" className="btn btn-ghost" onClick={() => refInput.current?.click()}><Icon name="file" className="h-4 w-4" />{refFile ? refFile.name.slice(0, 24) : "Adjuntar PDF o texto"}</button>
                    </div>
                    {refFile && <button type="button" className="mt-1 text-xs text-bad hover:underline" onClick={() => setRefFile(null)}>Quitar archivo</button>}
                    <input ref={refInput} type="file" hidden accept=".pdf,.txt,.md,.markdown,.csv,.html,.htm,application/pdf,text/*" onChange={(e) => setRefFile(e.target.files?.[0] ?? null)} />
                  </details>
                  <div><label className="label">Descripción o contexto adicional</label>
                    <textarea className="input" rows={3} value={f.notes} onChange={set("notes")} placeholder="Qué hace la empresa, problemas actuales, metas, datos internos…" /><p className="mt-1 text-xs text-soft">Las notas y documentos se envían a nuestro proveedor de IA. No incluyas datos personales de clientes o trabajadores.</p></div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div><h2 className="display text-xl font-bold">¿Qué análisis quieres?</h2><p className="text-sm text-soft">Elige un punto de partida o arma tu combinación. Después podrás agregar más sin repetir la investigación.</p></div>
                  <LayoutGroup id="presets">
                    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                      {PRESETS.map((p) => (
                        <button key={p.key} type="button" onClick={() => setMods(p.modules)} className={`relative rounded-xl border p-3 text-left ${preset === p.key ? "border-ink text-white" : "border-line bg-white"}`}>
                          {preset === p.key && <motion.span layoutId="preset-bg" className="absolute inset-0 rounded-xl bg-ink" transition={{ type: "spring", stiffness: 380, damping: 30 }} />}
                          <span className="relative block text-sm font-semibold">{p.label}</span>
                          <span className={`relative block text-xs ${preset === p.key ? "text-white/70" : "text-soft"}`}>{p.desc}</span>
                        </button>
                      ))}
                    </div>
                  </LayoutGroup>
                  <motion.div className="space-y-4" variants={stagger(0.06)} initial="hidden" animate="show">
                    {PHASES.map((ph) => (
                      <div key={ph.key} className="space-y-4 rounded-2xl border border-line p-4">
                        <p className="text-sm font-bold">{ph.label} <span className="font-normal text-soft">· {ph.hint}</span></p>
                    {GROUPS.filter((g) => ph.groups.includes(g.key)).map((g) => (
                      <motion.div key={g.key} variants={item}>
                        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-soft">{g.label} <span className="font-normal normal-case tracking-normal">· {g.hint}</span></p>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {MODULES.filter((m) => m.group === g.key).map((m) => {
                            const on = mods.includes(m.key);
                            return (
                              <motion.button key={m.key} type="button" onClick={() => toggle(m.key)} whileTap={{ scale: 0.97 }} whileHover={{ y: -2 }}
                                animate={{ borderColor: on ? "var(--brand)" : "var(--line)", backgroundColor: on ? "#eef7f5" : "#ffffff" }}
                                className="flex items-start gap-3 rounded-xl border p-3 text-left">
                                <motion.span animate={{ backgroundColor: on ? "var(--brand)" : "#f3f1ea", color: on ? "#fff" : "var(--ink-soft)", rotate: on ? [0, -12, 0] : 0 }}
                                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"><Icon name={m.icon} className="h-4.5 w-4.5" /></motion.span>
                                <span className="min-w-0 flex-1">
                                  <span className="block text-sm font-semibold">{m.label}</span>
                                  <span className="block text-xs text-soft">{m.desc}</span>
                                  {m.requires && <span className="mt-0.5 block text-[10px] text-soft">Requiere {m.requires.map((r) => moduleDef(r).label).join(", ")}</span>}
                                </span>
                                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${on ? "border-brand bg-brand text-white" : "border-line"}`}>
                                  <AnimatePresence>{on && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Icon name="check" className="h-3.5 w-3.5" /></motion.span>}</AnimatePresence>
                                </span>
                              </motion.button>
                            );
                          })}
                        </div>
                      </motion.div>
                    ))}
                      </div>
                    ))}
                  </motion.div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-[#fbfaf7] px-5 py-4">
          <div className="min-w-0 text-sm">
            <AnimatePresence mode="wait">
              {err ? <motion.p key="err" className="font-semibold text-bad" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: [0, -4, 4, 0] }} exit={{ opacity: 0 }}>{err}</motion.p>
                : step === 2 ? <motion.p key={mods.length} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-soft"><strong className="text-ink">{mods.length}</strong> herramienta{mods.length === 1 ? "" : "s"} · ~{estimate(mods)}</motion.p>
                : <motion.p key="s" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-soft">Paso {step + 1} de {STEPS.length}</motion.p>}
            </AnimatePresence>
          </div>
          <div className="flex gap-2">
            {step > 0 && <button type="button" className="btn btn-ghost" onClick={() => go(step - 1)}><Icon name="arrowLeft" className="h-4 w-4" />Atrás</button>}
            {step < 2
              ? <button type="button" className="btn btn-primary" onClick={next}>Continuar<Icon name="arrowRight" className="h-4 w-4" /></button>
              : <motion.button type="button" whileTap={{ scale: 0.97 }} className="btn btn-primary" disabled={busy || !mods.length} onClick={submit}>
                  {busy ? <Spinner /> : <Icon name="sparkle" className="h-4 w-4" />}{busy ? "Iniciando…" : "Generar análisis"}
                </motion.button>}
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}

type Row = { id: number; subject_name: string; subject_kind: string; website_url: string | null; doc_name: string | null; status: string; date: string; done: ModuleKey[]; modules: ModuleKey[] };

/** Tarjetas de análisis realizados con la cobertura de herramientas de cada uno. */
export function StrategyList({ rows }: { rows: Row[] }) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3" variants={stagger(0.05)} initial="hidden" animate="show">
        <AnimatePresence>{rows.map((r) => {
          const live = r.status === "queued" || r.status === "running";
          const host = r.website_url ? new URL(r.website_url).hostname.replace(/^www\./, "") : null;
          return (
            <motion.div key={r.id} variants={item} layout exit={{ opacity: 0, scale: 0.9 }} whileHover={{ y: -3 }} className="card group relative flex flex-col p-4">
              <Link href={`/strategy/${r.id}`} className="absolute inset-0 rounded-[14px]" aria-label={`Ver ${r.subject_name}`} />
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold group-hover:text-brand">{r.subject_name}</p>
                  <p className="truncate text-xs text-soft">{r.subject_kind === "propia" ? "Mi empresa" : "Externa"} · {[host, r.doc_name].filter(Boolean).join(" · ") || "Web"}</p>
                </div>
                <span className={`flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${r.status === "completed" ? "bg-emerald-50 text-emerald-800" : r.status === "failed" ? "bg-red-50 text-red-800" : "bg-sky-50 text-sky-800"}`}>
                  {live && <Spinner className="h-3 w-3" />}{STATUS_LABEL[r.status] ?? r.status}
                </span>
              </div>
              <div className="mt-4 flex gap-1">
                {MODULES.map((m, i) => {
                  const done = r.done.includes(m.key), sel = r.modules.includes(m.key);
                  return <motion.span key={m.key} title={m.label} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: 0.2 + i * 0.03 }}
                    className={`h-2 flex-1 origin-bottom rounded-full ${done ? "bg-brand" : sel ? "bg-brand/30" : "bg-[#ece9e0]"}`} />;
                })}
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-soft">
                <span>{r.done.length}/{MODULES.length} herramientas · {r.date}</span>
                {!live && <span className="relative"><DeleteStrategyButton id={r.id} small /></span>}
              </div>
            </motion.div>
          );
        })}</AnimatePresence>
      </motion.div>
    </MotionConfig>
  );
}

export function DeleteStrategyButton({ id, small = false }: { id: number; small?: boolean }) {
  const router = useRouter();
  return (
    <button className={`btn btn-danger ${small ? "!px-2 !py-0.5 text-xs" : "!px-3 !py-1.5"}`} onClick={async () => {
      if (!confirm("¿Eliminar este análisis estratégico?")) return;
      const r = await fetch(`/api/strategy/${id}`, { method: "DELETE" });
      if (!r.ok) { alert((await r.json().catch(() => ({}))).error || "No se pudo eliminar"); return; }
      router.refresh();
    }}>Eliminar</button>
  );
}
