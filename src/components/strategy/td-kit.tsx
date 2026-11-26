"use client";
// Piezas comunes de los paneles de la fase III: procedencia de los datos, barra de acciones
// (editar, guardar, validar, regenerar, exportar) y utilidades de exportación.
import { motion } from "motion/react";
import { useState, type ReactNode } from "react";
import { moduleDef, type ModuleKey } from "@/lib/strategy-modules";
import { ORIGEN, ORIGENES, toCsv } from "@/lib/td";
import type { Origen, StrategicResult } from "@/lib/types";
import { Icon } from "./icons";
import { Spinner } from "./motion-kit";

export type TdProps = {
  result: StrategicResult; subject: string;
  /** Sin id (p. ej. en la versión imprimible) los paneles se muestran solo para lectura. */
  id?: number; live?: boolean;
  onResult?: (r: StrategicResult) => void;
  onQueued?: (modules: ModuleKey[]) => void;
};

export function OrigenBadge({ o, className = "" }: { o: Origen; className?: string }) {
  const d = ORIGEN[o] ?? ORIGEN.ia;
  return <span title={d.hint} className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-1.5 py-px text-[10px] font-semibold ${d.cls} ${className}`}>{d.label}</span>;
}

export function OrigenLegend({ counts }: { counts?: Partial<Record<Origen, number>> }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-soft">
      <span className="font-semibold">Procedencia:</span>
      {ORIGENES.map((o) => (
        <span key={o} className="inline-flex items-center gap-1"><OrigenBadge o={o} />{counts && <span className="tabular-nums">{counts[o] ?? 0}</span>}<span className="hidden sm:inline">{ORIGEN[o].hint}</span></span>
      ))}
    </div>
  );
}
export const countOrigen = (items: { origen: Origen }[]) => items.reduce<Partial<Record<Origen, number>>>((m, x) => ({ ...m, [x.origen]: (m[x.origen] ?? 0) + 1 }), {});

export function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const downloadCsv = (name: string, rows: (string | number | null | undefined)[][]) => downloadFile(`${name}.csv`, toCsv(rows), "text/csv;charset=utf-8");

/** Exporta un bloque del reporte como documento de Word (HTML que Word abre y permite guardar como .docx). */
export function downloadWord(elementId: string, name: string, title: string) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".no-print, button, svg").forEach((n) => n.remove());
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.4}h2{font-size:18pt}h3{font-size:13pt;margin-top:14pt}table{border-collapse:collapse;width:100%;margin:6pt 0}th,td{border:1px solid #999;padding:3pt 5pt;font-size:9.5pt;vertical-align:top}th{background:#eef2f0}li{margin:2pt 0}</style></head><body>${clone.innerHTML}</body></html>`;
  downloadFile(`${name}.doc`, "﻿" + html, "application/msword");
}

type Api = { busy: string | null; error: string; warnings: string[]; call: (action: "save" | "validate" | "regenerate", body?: Record<string, unknown>) => Promise<boolean> };
export function useTdApi(k: ModuleKey, p: TdProps): Api {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const call: Api["call"] = async (action, body = {}) => {
    if (!p.id) return false;
    setBusy(action); setError("");
    try {
      const r = await fetch(`/api/strategy/${p.id}/td`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, module: k, ...body }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setError(j.error || "No se pudo completar la acción"); return false; }
      if (j.result) p.onResult?.(j.result);
      if (j.queued) p.onQueued?.(j.modules);
      setWarnings(j.warnings ?? []);
      return true;
    } finally { setBusy(null); }
  };
  return { busy, error, warnings, call };
}

/**
 * Barra superior de cada agente: estado de validación, edición, regeneración y exportación.
 * `onSave` devuelve los datos a guardar; si no se pasa, la herramienta no es editable.
 */
export function TdBar({ k, p, editing, setEditing, onSave, onCancel, exports, children }: {
  k: ModuleKey; p: TdProps; editing?: boolean; setEditing?: (v: boolean) => void;
  onSave?: () => Record<string, unknown> | null; onCancel?: () => void;
  exports?: { label: string; run: () => void }[]; children?: ReactNode;
}) {
  const api = useTdApi(k, p);
  const v = p.result.validaciones?.[k];
  const canAct = !!p.id && !p.live;
  const fecha = v && new Date(v.fecha).toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Lima" });
  const regenerate = () => { if (confirm(`¿Volver a ejecutar el agente de ${moduleDef(k).label.toLowerCase()}? Se descartan el resultado actual y tus ediciones de esta herramienta.`)) api.call("regenerate"); };
  return (
    <div className="no-print mb-4 space-y-2">
      <div className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-sm ${v ? "border-emerald-200 bg-emerald-50" : "border-line bg-white"}`}>
        <span className={`flex h-6 w-6 items-center justify-center rounded-full ${v ? "bg-good text-white" : "bg-[#f3f1ea] text-soft"}`}><Icon name={v ? "check" : "clock"} className="h-3.5 w-3.5" /></span>
        <span className="min-w-0 flex-1">{v ? <><strong>Validado</strong> por {v.por} · {fecha}</> : <><strong>Sin validar.</strong> <span className="text-soft">Revisa, corrige si hace falta y valida el resultado.</span></>}</span>
        {children}
        {exports?.map((e) => <button key={e.label} type="button" onClick={e.run} className="btn btn-ghost !px-2.5 !py-1 text-xs"><Icon name="file" className="h-3.5 w-3.5" />{e.label}</button>)}
        {canAct && onSave && !editing && <button type="button" onClick={() => setEditing?.(true)} className="btn btn-ghost !px-2.5 !py-1 text-xs"><Icon name="edit" className="h-3.5 w-3.5" />Editar</button>}
        {canAct && editing && <>
          <button type="button" onClick={() => { onCancel?.(); setEditing?.(false); }} className="btn btn-ghost !px-2.5 !py-1 text-xs">Cancelar</button>
          <button type="button" disabled={!!api.busy} onClick={async () => { const d = onSave?.(); if (d && await api.call("save", { data: d })) setEditing?.(false); }} className="btn btn-primary !px-2.5 !py-1 text-xs">{api.busy === "save" ? <Spinner className="h-3.5 w-3.5" /> : <Icon name="check" className="h-3.5 w-3.5" />}Guardar</button>
        </>}
        {canAct && !editing && <button type="button" disabled={!!api.busy} onClick={() => api.call("validate", { on: !v })} className={`btn !px-2.5 !py-1 text-xs ${v ? "btn-ghost" : "btn-primary"}`}>{api.busy === "validate" ? <Spinner className="h-3.5 w-3.5" /> : null}{v ? "Quitar validación" : "Validar"}</button>}
        {canAct && !editing && <button type="button" title="Volver a ejecutar este agente" disabled={!!api.busy} onClick={regenerate} className="btn btn-ghost !px-2 !py-1 text-xs"><Icon name="refresh" className="h-3.5 w-3.5" /></button>}
      </div>
      {api.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-bad">{api.error}</p>}
      {api.warnings.map((w, i) => <p key={i} className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-warn">{w}</p>)}
    </div>
  );
}

export function Tile({ label, value, hint, tone, i = 0 }: { label: string; value: ReactNode; hint?: ReactNode; tone?: string; i?: number }) {
  return (
    <motion.div className="card p-3.5" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-soft">{label}</p>
      <p className={`display mt-1 text-2xl font-bold leading-tight ${tone ?? ""}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-soft">{hint}</p>}
    </motion.div>
  );
}

export function Field({ value, onChange, area, className = "", type = "text" }: { value: string | number; onChange: (v: string) => void; area?: boolean; className?: string; type?: string }) {
  return area
    ? <textarea className={`input !px-2 !py-1 text-xs ${className}`} rows={2} value={value} onChange={(e) => onChange(e.target.value)} />
    : <input className={`input !px-2 !py-1 text-xs ${className}`} type={type} value={value} onChange={(e) => onChange(e.target.value)} />;
}

export function Th({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <th className={`px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-soft ${className}`}>{children}</th>;
}
export function Td({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-top ${className}`}>{children}</td>;
}

export function Bullets({ title, items, tone = "" }: { title: string; items: string[]; tone?: string }) {
  if (!items.length) return null;
  return (
    <div className={`rounded-xl px-4 py-3 text-sm ${tone || "bg-[#fbfaf7]"}`}>
      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-soft">{title}</p>
      <ul className="list-disc space-y-0.5 pl-5">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  );
}

/** Copia profunda para editar sin tocar el resultado mostrado hasta guardar. */
export const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
