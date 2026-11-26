"use client";
import { Fragment, useMemo } from "react";
import { referenceList, splitCitations, theoryRef, type Reference } from "@/lib/apa";
import { MODULES, moduleDone, type ModuleKey } from "@/lib/strategy-modules";
import type { StrategicResult } from "@/lib/types";

/** Referencias del reporte: fuentes web + marco teórico de las herramientas generadas. */
export function reportRefs(result: StrategicResult): Reference[] {
  const ids = MODULES.filter((m) => moduleDone(m.key, result)).flatMap((m) => m.refs);
  return referenceList(result.research, [...new Set(ids)]);
}
export function useRefs(result: StrategicResult) {
  return useMemo(() => reportRefs(result), [result]);
}

/** Texto con las citas APA "(Autor, año)" convertidas en enlaces a su referencia. Respeta los saltos de párrafo. */
export function CiteText({ text, refs, className }: { text: string; refs: Reference[]; className?: string }) {
  const paras = text.split(/\n{2,}/).filter((p) => p.trim());
  return <>{paras.map((p, i) => (
    <p key={i} className={`${className ?? ""} ${i ? "mt-3" : ""}`}>
      {splitCitations(p, refs).map((part, j) => "cite" in part
        ? <a key={j} href={`#ref-${part.ref.id}`} title={part.ref.titulo} className="text-brand underline decoration-brand/30 underline-offset-2 hover:decoration-brand">{part.cite}</a>
        : <Fragment key={j}>{part.text}</Fragment>)}
    </p>
  ))}</>;
}

/** Referencia formateada en APA 7, con sangría francesa y la URL como hipervínculo. */
export function RefEntry({ r, anchor = true }: { r: Reference; anchor?: boolean }) {
  return (
    <li id={anchor ? `ref-${r.id}` : undefined} className="ref scroll-mt-24 rounded-md py-1 pl-8 -indent-8 text-sm leading-relaxed transition-colors">
      {r.autor} ({r.anio}). {r.articulo ? <>{r.titulo}. <em>{r.fuente}</em>.</> : <><em>{r.titulo}</em>.{r.fuente && <> {r.fuente}.</>}</>}
      {r.url && <> <a className="break-all text-brand hover:underline" href={r.url} target="_blank" rel="noreferrer noopener">{r.url}</a></>}
    </li>
  );
}

export function RefList({ refs, anchor = true }: { refs: Reference[]; anchor?: boolean }) {
  return <ol className="space-y-1">{refs.map((r) => <RefEntry key={r.id} r={r} anchor={anchor} />)}</ol>;
}

/** "Fundamento teórico: (Porter, 1985)" con enlace a la referencia. */
export function TheoryLine({ k }: { k: ModuleKey }) {
  const refs = MODULES.find((m) => m.key === k)?.refs.map(theoryRef).filter((r): r is Reference => !!r) ?? [];
  if (!refs.length) return null;
  return (
    <p className="text-xs text-soft">Fundamento teórico: ({refs.map((r, i) => (
      <Fragment key={r.id}>{i > 0 && "; "}<a href={`#ref-${r.id}`} className="text-brand hover:underline">{r.cita}</a></Fragment>
    ))})</p>
  );
}

/** Enlace directo a otra herramienta del reporte (el workspace cambia de vista con el hash). */
export function ToolLink({ k, label }: { k: string; label: string }) {
  return <a href={`#${k}`} className="no-print inline-flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-0.5 text-xs font-semibold text-brand hover:border-brand">{label} →</a>;
}
