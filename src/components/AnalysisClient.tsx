"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { LogRow } from "@/lib/types";

export function AnalyzeButton({ productId, label = "Analizar mercado", ghost = false }: { productId: number; label?: string; ghost?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <>
      <button className={`btn ${ghost ? "btn-ghost" : "btn-primary"}`} disabled={busy} onClick={async () => {
        setBusy(true); setErr("");
        const r = await fetch("/api/analyses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) { setErr(j.error || "Error"); setBusy(false); return; }
        router.push(`/analyses/${j.id}`);
      }}>{busy ? "Iniciando…" : label}</button>
      {err && <span className="text-xs text-bad">{err}</span>}
    </>
  );
}

type Step = { key: string; label: string };

export const STEPS: Step[] = [
  { key: "planificacion", label: "Planificación" },
  { key: "busqueda", label: "Búsqueda y scraping" },
  { key: "normalizacion", label: "Normalización" },
  { key: "analisis", label: "Análisis estratégico" },
  { key: "guardado", label: "Guardado" },
];

export const STRATEGIC_STEPS: Step[] = [
  { key: "planificacion", label: "Planificación" },
  { key: "investigacion", label: "Investigación" },
  { key: "analisis", label: "Análisis estratégico" },
  { key: "guardado", label: "Guardado" },
];

function LogList({ logs, steps = STEPS }: { logs: LogRow[]; steps?: Step[] }) {
  const time = (ts: string) => new Date(ts).toLocaleTimeString("es-PE", { hour12: false, timeZone: "America/Lima" });
  return (
    <ol className="space-y-0">
      {logs.map((l) => (
        <li key={l.id} className="flex gap-3 border-l-2 border-line py-1.5 pl-4 text-sm">
          <span className="w-16 shrink-0 font-mono text-xs text-soft">{time(l.ts)}</span>
          <span className="w-28 shrink-0 text-xs font-semibold uppercase tracking-wide text-brand">{steps.find((s) => s.key === l.step)?.label ?? l.step}</span>
          <span className={`whitespace-pre-wrap break-words ${l.level === "error" ? "text-bad" : l.level === "warn" ? "text-warn" : l.level === "success" ? "text-good" : ""}`}>{l.message}</span>
        </li>
      ))}
    </ol>
  );
}

export function StaticLog({ logs, steps }: { logs: LogRow[]; steps?: Step[] }) {
  return <LogList logs={logs} steps={steps} />;
}

/** Timeline en vivo: polling cada 2s a /api/analyses/[id] (o al endpoint indicado). */
export function LiveTimeline({ analysisId, initialLogs, initialStatus, endpoint = `/api/analyses/${analysisId}`, steps = STEPS }: {
  analysisId: number; initialLogs: LogRow[]; initialStatus: string; endpoint?: string; steps?: Step[];
}) {
  const router = useRouter();
  const [logs, setLogs] = useState(initialLogs);
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const last = useRef(initialLogs.at(-1)?.id ?? 0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch(`${endpoint}?after=${last.current}`, { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        if (stop) return;
        if (j.logs.length) { last.current = j.logs.at(-1).id; setLogs((p) => [...p, ...j.logs]); }
        setStatus(j.status); setError(j.error);
        if (j.status === "completed" || j.status === "failed") { stop = true; clearInterval(iv); router.refresh(); }
      } catch { /* reintenta en el siguiente tick */ }
    };
    const iv = setInterval(tick, 2000);
    const clock = setInterval(() => setElapsed((e) => e + 1), 1000);
    tick();
    return () => { stop = true; clearInterval(iv); clearInterval(clock); };
  }, [endpoint, router]);

  const seen = new Set(logs.map((l) => l.step));
  const currentIdx = Math.max(-1, ...steps.map((s, i) => (seen.has(s.key) ? i : -1)));
  const done = status === "completed" || status === "failed";
  return (
    <div className="card p-5">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {steps.map((s, i) => {
          const state = status === "completed" || i < currentIdx ? "done" : i === currentIdx ? (status === "failed" ? "fail" : "active") : "todo";
          return (
            <div key={s.key} className="flex items-center gap-2">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white ${state === "done" ? "bg-good" : state === "active" ? "bg-accent pulse-dot" : state === "fail" ? "bg-bad" : "bg-slate-300"}`}>{state === "done" ? "✓" : i + 1}</span>
              <span className={`text-sm ${state === "todo" ? "text-soft" : "font-semibold"}`}>{s.label}</span>
              {i < steps.length - 1 && <span className="mx-1 hidden h-px w-6 bg-line sm:block" />}
            </div>
          );
        })}
      </div>
      <div className="mb-3 flex items-center justify-between text-xs text-soft">
        <span>{done ? (status === "failed" ? "El análisis falló" : "Completado") : `El agente está trabajando… ${elapsed}s`}</span>
        <span>Actualiza cada 2 s</span>
      </div>
      <div className="max-h-[28rem] overflow-y-auto rounded-lg bg-[#fbfaf7] p-3">
        {logs.length ? <LogList logs={logs} steps={steps} /> : <p className="text-sm text-soft">En cola, esperando turno…</p>}
      </div>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-bad">{error}</p>}
    </div>
  );
}
