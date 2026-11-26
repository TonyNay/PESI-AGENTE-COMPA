// Cálculos y validaciones de los agentes de la fase III. Sin dependencias de Node: se usan en el servidor
// (al guardar lo que entrega el modelo o lo que edita el usuario) y en el cliente (recalcular en vivo).
import { citeAuthor } from "./apa";
import type {
  AlignLevel, BudgetCategory, BudgetLine, DigitalStrategies, GapDiagnosis, KpiCard, KpiDesign, Literature, Operationalization,
  Origen, ParetoAnalysis, ScientificRef, StdMatrix, StrategicPlan, TechBudget,
} from "./types";

export const ORIGEN: Record<Origen, { label: string; hint: string; cls: string }> = {
  usuario: { label: "Usuario", hint: "Dato ingresado o corregido por la organización", cls: "bg-sky-50 text-sky-700 border-sky-200" },
  fuente: { label: "Fuente externa", hint: "Obtenido de una fuente verificable (con enlace)", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  estimacion: { label: "Estimación", hint: "Valor aproximado: no es una cotización ni un dato medido", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  ia: { label: "Propuesta IA", hint: "Propuesta del agente: requiere revisión de una persona", cls: "bg-violet-50 text-violet-700 border-violet-200" },
};
export const ORIGENES = Object.keys(ORIGEN) as Origen[];
const asOrigen = (o: unknown, fallback: Origen = "ia"): Origen => (ORIGENES.includes(o as Origen) ? (o as Origen) : fallback);
const isUrl = (u: unknown) => typeof u === "string" && /^https?:\/\/\S+\.\S+/.test(u.trim());
const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const txt = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v));
const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

/** Estrategias del plan con un id estable (E1, E2…) para enlazar las matrices de los agentes. */
export function planStrategies(plan: Partial<StrategicPlan>) {
  return (plan.estrategias ?? []).map((e, i) => ({ id: `E${i + 1}`, ...e }));
}

// ---------------- 1. S/TD ----------------
export function sanitizeStd(m: StdMatrix, plan: Partial<StrategicPlan>): { data: StdMatrix; warnings: string[] } {
  const ids = planStrategies(plan);
  const warnings: string[] = [];
  const filas = (m.filas ?? []).filter((f) => f && txt(f.std)).map((f, i) => {
    const match = ids.find((e) => e.id === f.id) ?? ids.find((e) => e.titulo === f.estrategia) ?? ids[i];
    return { ...f, id: match?.id ?? f.id ?? `E${i + 1}`, estrategia: match?.titulo ?? txt(f.estrategia), origen: asOrigen(f.origen) };
  });
  const missing = ids.filter((e) => !filas.some((f) => f.id === e.id));
  if (missing.length) warnings.push(`Estrategias sin S/TD asignada: ${missing.map((e) => e.id).join(", ")}.`);
  const capacidades = (m.capacidades_actuales ?? []).map((c) => ({ ...c, origen: asOrigen(c.origen, "fuente") }));
  return { data: { ...m, filas, capacidades_actuales: capacidades }, warnings };
}

// ---------------- 2. Pareto ----------------
export const PARETO_CRITERIA = [
  { key: "impacto", nombre: "Impacto esperado" },
  { key: "urgencia", nombre: "Urgencia" },
  { key: "contribucion", nombre: "Contribución a los objetivos" },
  { key: "recursos", nombre: "Recursos disponibles" },
  { key: "viabilidad", nombre: "Viabilidad de implementación" },
];

export function sanitizePareto(p: ParetoAnalysis, std?: StdMatrix): { data: ParetoAnalysis; warnings: string[] } {
  const warnings: string[] = [];
  const criterios = (p.criterios ?? []).map((c) => ({ ...c, key: txt(c.key) || txt(c.nombre).toLowerCase(), peso: Math.max(0, num(c.peso)) }));
  const keys = new Set(criterios.map((c) => c.key));
  const valid = new Set((std?.filas ?? []).map((f) => f.id));
  const evaluaciones = (p.evaluaciones ?? []).filter((e) => !valid.size || valid.has(e.id)).map((e) => ({
    ...e, origen: asOrigen(e.origen),
    puntajes: (e.puntajes ?? []).filter((x) => keys.has(x.criterio)).map((x) => ({ ...x, valor: Math.min(5, Math.max(1, Math.round(num(x.valor, 1)))) })),
  }));
  for (const e of evaluaciones) {
    const miss = criterios.filter((c) => !e.puntajes.some((x) => x.criterio === c.key));
    if (miss.length) warnings.push(`${e.id}: sin puntaje en ${miss.map((c) => c.nombre).join(", ")} (cuenta como 1).`);
  }
  return { data: { ...p, criterios, evaluaciones, corte: Math.min(95, Math.max(50, num(p.corte, 80))) }, warnings };
}

export type ParetoRow = { id: string; estrategia: string; std: string; score: number; share: number; cum: number; clase: "A" | "B" | "C" };
export function computePareto(p: ParetoAnalysis, std?: StdMatrix, weights?: Record<string, number>) {
  const crit = p.criterios.map((c) => ({ ...c, peso: Math.max(0, weights?.[c.key] ?? c.peso) }));
  const sumW = crit.reduce((s, c) => s + c.peso, 0) || crit.length || 1;
  const w = Object.fromEntries(crit.map((c) => [c.key, sumW === crit.length && !crit.some((x) => x.peso) ? 1 / crit.length : c.peso / sumW]));
  const scored = p.evaluaciones.map((e) => {
    const score = crit.reduce((s, c) => s + w[c.key] * (e.puntajes.find((x) => x.criterio === c.key)?.valor ?? 1), 0);
    const fila = std?.filas.find((f) => f.id === e.id);
    return { id: e.id, estrategia: fila?.estrategia ?? e.id, std: fila?.std ?? "", score: round(score, 3) };
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const total = scored.reduce((s, r) => s + r.score, 0) || 1;
  const corte = p.corte ?? 80;
  let acc = 0;
  const rows: ParetoRow[] = scored.map((r) => {
    const before = acc;
    const share = (r.score / total) * 100;
    acc += share;
    // Clasificación ABC: A hasta el corte acumulado (al menos la primera), B hasta 95 %, C el resto.
    const cum = round(acc, 1);
    return { ...r, share: round(share, 1), cum, clase: before === 0 || cum <= corte ? "A" : cum <= 95 ? "B" : "C" };
  });
  const n = rows.length;
  const a = rows.filter((r) => r.clase === "A");
  const pctItems = n ? (a.length / n) * 100 : 0;
  const top = Math.max(1, Math.ceil(n * 0.2));
  const topShare = rows.slice(0, top).reduce((s, r) => s + r.share, 0);
  // La regla 80/20 no se asume: se informa cuánto se acerca la distribución real.
  const cumple = n >= 5 && pctItems <= 30;
  const mensaje = !n ? "Sin evaluaciones."
    : `${a.length} de ${n} estrategias (${round(pctItems, 0)} %) reúnen el ${round(a.reduce((s, r) => s + r.share, 0), 0)} % de la contribución estimada; el 20 % superior (${top}) aporta el ${round(topShare, 0)} %. ${cumple
      ? "La distribución se aproxima al principio de Pareto: pocas estrategias concentran la mayor parte del aporte."
      : "La distribución NO se ajusta a la regla 80/20: el aporte está repartido, así que la priorización se apoya en el orden de los puntajes y no en una concentración extrema."}`;
  return { rows, weights: w, total: round(total, 3), cumple, mensaje, pctItems: round(pctItems, 0), topShare: round(topShare, 0) };
}

// ---------------- 3. Presupuesto ----------------
export const BUDGET_CATEGORIES: BudgetCategory[] = ["Hardware", "Software", "Licencias", "Infraestructura", "Desarrollo", "Implementación", "Capacitación", "Mantenimiento", "Personal", "Otros"];

export function sanitizeBudget(b: TechBudget): { data: TechBudget; warnings: string[] } {
  const warnings: string[] = [];
  let downgraded = 0;
  const partidas = (b.partidas ?? []).filter((x) => txt(x.concepto)).map((x, i): BudgetLine => {
    let origen = asOrigen(x.origen, "estimacion");
    // Un precio "de fuente" sin enlace verificable se muestra como estimación: nunca como cotización.
    if (origen === "fuente" && !isUrl(x.fuente_url)) { origen = "estimacion"; downgraded++; }
    if (origen === "ia") origen = "estimacion";
    const tipo = x.tipo === "recurrente" ? "recurrente" : "inicial";
    const periodicidad = tipo === "inicial" ? "unica" : x.periodicidad === "anual" ? "anual" : "mensual";
    return {
      ...x, id: txt(x.id) || `P${i + 1}`, concepto: txt(x.concepto), categoria: BUDGET_CATEGORIES.includes(x.categoria) ? x.categoria : "Otros",
      tipo, periodicidad, cantidad: Math.max(0, num(x.cantidad, 1)), costo_unitario: Math.max(0, num(x.costo_unitario)),
      unidad: txt(x.unidad) || "unidad", origen, fuente_url: isUrl(x.fuente_url) ? txt(x.fuente_url) : "", nota: txt(x.nota),
    };
  });
  if (downgraded) warnings.push(`${downgraded} costo(s) sin enlace verificable se marcaron como estimación.`);
  const disponible = b.disponible == null || txt(b.disponible) === "" ? null : Math.max(0, num(b.disponible));
  return { data: { ...b, moneda: txt(b.moneda) || "PEN", disponible, horizonte_meses: Math.min(60, Math.max(1, Math.round(num(b.horizonte_meses, 12)))), partidas }, warnings };
}

export const lineAnnual = (x: BudgetLine) => x.cantidad * x.costo_unitario * (x.tipo === "inicial" ? 1 : x.periodicidad === "mensual" ? 12 : 1);
export function computeBudget(b: TechBudget) {
  const inicial = b.partidas.filter((x) => x.tipo === "inicial").reduce((s, x) => s + x.cantidad * x.costo_unitario, 0);
  const recurrenteAnual = b.partidas.filter((x) => x.tipo === "recurrente").reduce((s, x) => s + lineAnnual(x), 0);
  const horizonte = inicial + recurrenteAnual * (b.horizonte_meses / 12);
  const group = <K extends string>(key: (x: BudgetLine) => K) => {
    const m = new Map<K, { inicial: number; recurrente: number }>();
    for (const x of b.partidas) {
      const g = m.get(key(x)) ?? { inicial: 0, recurrente: 0 };
      if (x.tipo === "inicial") g.inicial += x.cantidad * x.costo_unitario; else g.recurrente += lineAnnual(x);
      m.set(key(x), g);
    }
    return [...m].map(([k, v]) => ({ key: k, inicial: round(v.inicial), recurrente: round(v.recurrente), total: round(v.inicial + v.recurrente) })).sort((a, z) => z.total - a.total);
  };
  const anio1 = inicial + recurrenteAnual;
  const estimado = b.partidas.filter((x) => x.origen === "estimacion").reduce((s, x) => s + lineAnnual(x), 0);
  return {
    inicial: round(inicial), recurrenteAnual: round(recurrenteAnual), anio1: round(anio1), horizonte: round(horizonte),
    porCategoria: group((x) => x.categoria), porEstrategia: group((x) => x.std_id),
    pctEstimado: anio1 ? round((estimado / anio1) * 100, 0) : 0,
    saldo: b.disponible == null ? null : round(b.disponible - anio1),
  };
}

// ---------------- 4. KPI ----------------
const KPI_KINDS = ["Eficacia", "Eficiencia", "Efectividad", "Productividad", "Calidad", "Otro"];
export function sanitizeKpis(k: KpiDesign, plan: Partial<StrategicPlan>): { data: KpiDesign; warnings: string[] } {
  const ids = planStrategies(plan);
  const indicadores = (k.indicadores ?? []).filter((x) => txt(x.nombre)).map((x, i): KpiCard => {
    const e = ids.find((s) => s.id === x.estrategia_id) ?? ids.find((s) => s.titulo === x.estrategia);
    const base = txt(x.linea_base);
    const pendiente = x.linea_base_estado === "pendiente" || !base || /pendiente|por levantar|n\/d|no disponible|desconoc/i.test(base);
    return {
      ...x, id: txt(x.id) || `K${i + 1}`, estrategia_id: e?.id ?? txt(x.estrategia_id), estrategia: e?.titulo ?? txt(x.estrategia),
      tipo: KPI_KINDS.includes(x.tipo) ? x.tipo : "Otro", linea_base: pendiente ? (base && !/^pendiente/i.test(base) ? base : "Pendiente de determinación") : base,
      linea_base_estado: pendiente ? "pendiente" : "disponible", origen: asOrigen(x.origen),
    };
  });
  const { sinKpi } = kpiCoverage({ indicadores, datos_solicitados: [] }, plan);
  return { data: { indicadores, datos_solicitados: (k.datos_solicitados ?? []).map(txt).filter(Boolean) }, warnings: sinKpi.length ? [`Estrategias sin KPI: ${sinKpi.join(", ")}.`] : [] };
}

const KPI_REQUIRED: [keyof KpiCard, string][] = [
  ["nombre", "nombre"], ["objetivo", "objetivo"], ["def_conceptual", "definición conceptual"], ["def_operacional", "definición operacional"],
  ["formula", "fórmula"], ["unidad", "unidad"], ["meta", "meta"], ["fuente", "fuente"], ["frecuencia", "frecuencia"], ["responsable", "responsable"],
];
/** Revisión de cada ficha: campos vacíos, línea base pendiente y coherencia entre fórmula y fuente. */
export function kpiChecks(x: KpiCard): { nivel: "ok" | "revisar" | "pendiente"; notas: string[] } {
  const notas: string[] = [];
  const vacios = KPI_REQUIRED.filter(([k]) => !txt(x[k])).map(([, l]) => l);
  if (vacios.length) notas.push(`Falta: ${vacios.join(", ")}.`);
  if (x.linea_base_estado === "pendiente") notas.push("Línea base pendiente: la meta es provisional hasta medirla.");
  if (txt(x.formula) && !/[/÷×*\-+%]|\bentre\b|\bsobre\b|\bpor\b/i.test(x.formula)) notas.push("La fórmula no indica una operación de cálculo.");
  if (txt(x.fuente) && /encuesta/i.test(x.fuente) && /\bsistema\b|registro/i.test(x.formula) === false && /tiempo|minutos|horas/i.test(x.formula)) notas.push("Revisar: una encuesta no suele medir tiempos de proceso.");
  if (/%|porcentaje/i.test(x.unidad) && txt(x.formula) && !/[/÷]|×\s*100|\*\s*100|%/.test(x.formula)) notas.push("La unidad es porcentaje pero la fórmula no es un cociente.");
  return { nivel: vacios.length ? "revisar" : x.linea_base_estado === "pendiente" ? "pendiente" : notas.length ? "revisar" : "ok", notas };
}
export function kpiCoverage(k: KpiDesign, plan: Partial<StrategicPlan>) {
  const ids = planStrategies(plan);
  const sinKpi = ids.filter((e) => !k.indicadores.some((x) => x.estrategia_id === e.id)).map((e) => e.id);
  const checks = k.indicadores.map(kpiChecks);
  return { sinKpi, total: k.indicadores.length, ok: checks.filter((c) => c.nivel === "ok").length, pendientes: checks.filter((c) => c.nivel === "pendiente").length, revisar: checks.filter((c) => c.nivel === "revisar").length };
}

// ---------------- 5. Literatura ----------------
export const AREAS: Record<1 | 2 | 3 | 4, string> = {
  1: "Gobierno y gestión",
  2: "Sistemas de información, ingeniería de software y procesos empresariales",
  3: "Big Data, inteligencia artificial, ciencia de datos y bases de datos",
  4: "Telecomunicaciones, redes y seguridad de la información",
};
export const SCI_BASES = ["Scopus", "Web of Science", "MDPI", "IEEE", "Springer", "ProQuest", "Otra"] as const;
const cleanDoi = (d: string) => txt(d).replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "").trim();
export const doiOk = (d: string) => /^10\.\d{4,9}\/\S+$/.test(cleanDoi(d));

export function sanitizeLiterature(l: Literature): { data: Literature; warnings: string[]; remap: Record<string, string> } {
  const warnings: string[] = [];
  const seen = new Set<string>();
  let n = 0, downgraded = 0;
  const referencias = (l.referencias ?? []).filter((r) => txt(r.titulo) && txt(r.autores)).flatMap((r): ScientificRef[] => {
    const doi = cleanDoi(r.doi);
    const key = (doiOk(doi) ? doi : txt(r.titulo)).toLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    const url = isUrl(r.url) ? txt(r.url) : doiOk(doi) ? `https://doi.org/${doi}` : "";
    let estado: ScientificRef["estado"] = r.estado === "consultada" ? "consultada" : "sugerida";
    // "Consultada" exige una página verificable; sin DOI ni URL solo puede ser una sugerencia por verificar.
    if (estado === "consultada" && !url) { estado = "sugerida"; downgraded++; }
    const area = ([1, 2, 3, 4] as const).includes(Number(r.area) as 1) ? (Number(r.area) as 1 | 2 | 3 | 4) : 2;
    return [{ ...r, id: `R${++n}`, area, anio: Math.round(num(r.anio)), doi: doiOk(doi) ? doi : "", url, estado, bases: (r.bases ?? []).filter((b) => (SCI_BASES as readonly string[]).includes(b)) }];
  });
  if (downgraded) warnings.push(`${downgraded} referencia(s) sin DOI ni URL quedaron como "sugeridas" (verificar antes de citar).`);
  // Las referencias se renumeran: se avisa para que la operacionalización use los ids nuevos.
  const old = new Map((l.referencias ?? []).map((r, i) => [txt(r.id) || `R${i + 1}`, r]));
  const remap = Object.fromEntries([...old].map(([k, r]) => [k, referencias.find((x) => x.titulo === txt(r.titulo))?.id ?? ""]));
  return { data: { consultas: (l.consultas ?? []).map(txt).filter(Boolean), nota: txt(l.nota), referencias }, warnings, remap };
}

export function literatureStats(l: Literature, now = new Date().getFullYear()) {
  const desde = now - 4;
  const byArea = ([1, 2, 3, 4] as const).map((a) => {
    const refs = l.referencias.filter((r) => r.area === a);
    return { area: a, nombre: AREAS[a], total: refs.length, recientes: refs.filter((r) => r.anio >= desde).length, consultadas: refs.filter((r) => r.estado === "consultada").length };
  });
  return {
    desde, byArea, total: l.referencias.length,
    recientes: l.referencias.filter((r) => r.anio >= desde).length,
    consultadas: l.referencias.filter((r) => r.estado === "consultada").length,
    conDoi: l.referencias.filter((r) => r.doi).length,
    cumpleMinimo: byArea.every((a) => a.total >= 3) && l.referencias.length >= 12,
  };
}

/** Cita en el texto: (Apellido et al., 2024). */
export const sciCite = (r: ScientificRef) => `${citeAuthor(r.autores)}, ${r.anio || "s.f."}`;
/** Artículo de revista en APA 7: Autores (año). Título. Revista, volumen(número), páginas. https://doi.org/… */
export function sciParts(r: ScientificRef) {
  const vol = [r.volumen && r.volumen, r.numero && `(${r.numero})`].filter(Boolean).join("");
  return {
    lead: `${r.autores.replace(/\.?\s*$/, ".")} (${r.anio || "s.f."}). ${r.titulo.replace(/\.\s*$/, "")}.`,
    revista: r.revista, vol: r.volumen, rest: `${r.numero ? `(${r.numero})` : ""}${r.paginas ? `, ${r.paginas}` : ""}.`,
    link: r.doi ? `https://doi.org/${r.doi}` : r.url, plainVol: vol,
  };
}
export function sciRefText(r: ScientificRef) {
  const p = sciParts(r);
  return `${p.lead} ${p.revista}${p.plainVol ? `, ${p.plainVol}` : ""}${r.paginas ? `, ${r.paginas}` : ""}.${p.link ? ` ${p.link}` : ""}`;
}

export function sanitizeOperationalization(o: Operationalization, l: Literature | undefined, remap?: Record<string, string>): { data: Operationalization; warnings: string[] } {
  const warnings: string[] = [];
  const valid = new Set((l?.referencias ?? []).map((r) => r.id));
  const fix = (ids: string[]) => [...new Set((ids ?? []).map((id) => remap?.[id] || id).filter((id) => valid.has(id)))];
  const variables = (o.variables ?? []).map((v) => {
    const dimensiones = (v.dimensiones ?? []).map((d) => ({ ...d, indicadores: (d.indicadores ?? []).map(txt).filter(Boolean), refs: fix(d.refs) }));
    const sin = dimensiones.filter((d) => !d.refs.length).map((d) => d.nombre);
    if (sin.length) warnings.push(`${v.nombre}: dimensiones sin sustento bibliográfico válido (${sin.join(", ")}).`);
    return { ...v, refs_conceptual: fix(v.refs_conceptual), dimensiones };
  });
  return { data: { ...o, variables }, warnings };
}

// ---------------- 6. Brechas ----------------
export const ALIGN_LABEL: Record<AlignLevel, string> = { 0: "Sin correspondencia", 1: "Baja", 2: "Parcial", 3: "Alta" };
export const ALIGN_CLS: Record<AlignLevel, string> = { 0: "bg-red-600 text-white", 1: "bg-orange-400 text-white", 2: "bg-amber-200 text-ink", 3: "bg-emerald-600 text-white" };
export function sanitizeGaps(g: GapDiagnosis): { data: GapDiagnosis; warnings: string[] } {
  const filas = (g.filas ?? []).filter((f) => txt(f.lineamiento)).map((f, i) => ({
    ...f, id: `L${i + 1}`, eje: txt(f.eje) || "General", nivel: Math.min(3, Math.max(0, Math.round(num(f.nivel)))) as AlignLevel,
    origen: asOrigen(f.origen, txt(f.evidencia_fuente) ? "fuente" : "ia"),
  }));
  const oldIds = (g.filas ?? []).filter((f) => txt(f.lineamiento)).map((f, i) => [txt(f.id) || `L${i + 1}`, `L${i + 1}`] as const);
  const remap = new Map(oldIds);
  const problemas = (g.problemas ?? []).filter((p) => txt(p.enunciado)).map((p, i) => ({ ...p, id: `P${i + 1}`, tipo: p.tipo === "general" ? "general" as const : "especifico" as const, lineamientos: (p.lineamientos ?? []).map((x) => remap.get(x) ?? x).filter((x) => filas.some((f) => f.id === x)) }));
  const sinEvidencia = filas.filter((f) => !txt(f.evidencia)).length;
  return { data: { ...g, filas, problemas }, warnings: sinEvidencia ? [`${sinEvidencia} lineamiento(s) sin evidencia documental.`] : [] };
}
export function gapIndex(g: GapDiagnosis) {
  const idx = (rows: GapDiagnosis["filas"]) => (rows.length ? round((rows.reduce((s, f) => s + f.nivel, 0) / (rows.length * 3)) * 100, 0) : 0);
  const ejes = [...new Set(g.filas.map((f) => f.eje))].map((eje) => {
    const rows = g.filas.filter((f) => f.eje === eje);
    return { eje, n: rows.length, indice: idx(rows) };
  });
  const niveles = ([0, 1, 2, 3] as const).map((n) => ({ nivel: n, label: ALIGN_LABEL[n], total: g.filas.filter((f) => f.nivel === n).length }));
  return { indice: idx(g.filas), ejes, niveles, criticas: g.filas.filter((f) => f.nivel <= 1).length };
}

// ---------------- 7. Estrategias de TD ----------------
export function sanitizeDigital(d: DigitalStrategies, g?: GapDiagnosis): { data: DigitalStrategies; warnings: string[] } {
  const filas = g?.filas ?? [];
  const propuestas = (d.propuestas ?? []).map((p, i) => {
    const f = filas.find((x) => x.id === p.lineamiento_id) ?? filas.find((x) => x.lineamiento === p.lineamiento);
    return { ...p, id: `T${i + 1}`, lineamiento_id: f?.id ?? txt(p.lineamiento_id), lineamiento: f?.lineamiento ?? txt(p.lineamiento), aplica: p.aplica !== false, origen: asOrigen(p.origen) };
  });
  const sin = filas.filter((f) => f.nivel < 3 && !propuestas.some((p) => p.lineamiento_id === f.id)).map((f) => f.id);
  return { data: { ...d, propuestas }, warnings: sin.length ? [`Lineamientos con brecha sin propuesta ni descarte justificado: ${sin.join(", ")}.`] : [] };
}

// ---------------- Exportación ----------------
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(cell).join(";")).join("\n");
}
export const money = (v: number, cur = "PEN") => `${cur === "PEN" ? "S/" : cur} ${v.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
