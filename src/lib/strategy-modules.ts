import type { StrategicPlan, StrategicResult } from "./types";

/** Herramientas del análisis estratégico que el usuario puede elegir. Se comparte entre cliente y servidor. */
export type ModuleKey = "identidad" | "canvas" | "cadena_valor" | "pestel" | "porter" | "mpc" | "foda" | "bcg" | "direccion" | "ansoff" | "estrategias" | "informe_gestion" | "informe_ejecutivo"
  // Fase III (ampliación): agentes especializados que trabajan sobre los resultados anteriores.
  | "std" | "pareto" | "presupuesto" | "kpis" | "investigacion" | "brechas" | "estrategias_td" | "informe_gestion_td" | "informe_ejecutivo_td";
/** Paso del agente que produce cada herramienta (pasos con esquemas pequeños, ver strategic.ts). */
export type ModuleStep = "identidad" | "entorno" | "foda" | "portafolio" | "direccion" | "plan" | "informe"
  | "td_std" | "td_pareto" | "td_presupuesto" | "td_kpis" | "td_investigacion" | "td_brechas" | "td_estrategias" | "td_informe";
export type ModuleGroup = "identidad" | "externo" | "interno" | "direccion" | "accion" | "informes"
  | "despliegue" | "investigacion" | "transformacion" | "informes_td";
/** Fases del sílabo: análisis de la situación actual y diseño de la solución. */
export type ModulePhase = "situacion" | "solucion" | "ampliacion";

export type ModuleDef = {
  key: ModuleKey; label: string; desc: string; group: ModuleGroup; step: ModuleStep;
  /** Claves de StrategicPlan que genera. */
  fields: (keyof StrategicPlan)[];
  requires?: ModuleKey[];
  icon: string;
  /** Referencias del marco teórico (ids de THEORY en apa.ts). */
  refs: string[];
  /** Número del agente especializado de la fase III que produce la herramienta. */
  agent?: number;
};

export const PHASES: { key: ModulePhase; label: string; hint: string; groups: ModuleGroup[] }[] = [
  { key: "situacion", label: "I. Análisis de la situación actual", hint: "Dónde está hoy la organización", groups: ["identidad", "externo", "interno"] },
  { key: "solucion", label: "II. Diseño de la solución", hint: "Qué hará y cómo se medirá", groups: ["direccion", "accion", "informes"] },
  { key: "ampliacion", label: "III. Despliegue con S/TD y transformación digital", hint: "Agentes especializados sobre los resultados anteriores", groups: ["despliegue", "investigacion", "transformacion", "informes_td"] },
];

export const GROUPS: { key: ModuleGroup; label: string; hint: string }[] = [
  { key: "identidad", label: "Identidad y modelo", hint: "Quién es y cómo crea valor" },
  { key: "externo", label: "Entorno externo", hint: "Macroentorno, sector y competencia" },
  { key: "interno", label: "Diagnóstico", hint: "Fortalezas, debilidades, posición y portafolio" },
  { key: "direccion", label: "Dirección estratégica", hint: "Estrategia general, de negocio y de crecimiento" },
  { key: "accion", label: "Plan de acción", hint: "Objetivos, estrategias y KPI" },
  { key: "informes", label: "Informes", hint: "Informe de gestión e informe ejecutivo" },
  { key: "despliegue", label: "Despliegue de estrategias", hint: "Tecnologías, prioridad, inversión e indicadores" },
  { key: "investigacion", label: "Investigación científica", hint: "Literatura indexada y operacionalización de variables" },
  { key: "transformacion", label: "Transformación digital", hint: "Brechas frente a una política o marco y propuestas" },
  { key: "informes_td", label: "Informes integrados", hint: "Consolidan los resultados de los agentes" },
];

export const MODULES: ModuleDef[] = [
  { key: "identidad", label: "Misión, visión y valores", desc: "Evalúa o redacta la misión y visión, con valores coherentes.", group: "identidad", step: "identidad", fields: ["mision", "vision", "valores"], icon: "compass", refs: ["david2017"] },
  { key: "canvas", label: "Business Model Canvas", desc: "Los 9 bloques del modelo de negocio.", group: "identidad", step: "identidad", fields: ["canvas"], icon: "canvas", refs: ["osterwalder2010"] },
  { key: "cadena_valor", label: "Cadena de valor", desc: "Actividades primarias y de apoyo, con al menos 5 procesos principales cada una.", group: "identidad", step: "identidad", fields: ["cadena_valor"], icon: "chain", refs: ["porter1985"] },
  { key: "pestel", label: "PESTEL", desc: "Factores político, económico, social, tecnológico, ecológico y legal.", group: "externo", step: "entorno", fields: ["pestel"], icon: "globe", refs: ["aguilar1967"] },
  { key: "porter", label: "Cinco fuerzas de Porter", desc: "Atractivo del sector según la intensidad de cada fuerza.", group: "externo", step: "entorno", fields: ["porter"], icon: "forces", refs: ["porter2008"] },
  { key: "mpc", label: "Perfil competitivo (MPC)", desc: "Compara factores clave de éxito frente a competidores reales.", group: "externo", step: "entorno", fields: ["mpc"], icon: "podium", refs: ["david2017"] },
  { key: "foda", label: "FODA · EFI/EFE · IE", desc: "FODA ponderado con matrices EFI, EFE y la matriz Interna-Externa.", group: "interno", step: "foda", fields: ["foda", "matriz_efi", "matriz_efe"], icon: "grid", refs: ["david2017", "weihrich1982"] },
  { key: "bcg", label: "Matriz BCG", desc: "Líneas de producto por crecimiento y participación relativa.", group: "interno", step: "portafolio", fields: ["bcg"], icon: "bubbles", refs: ["henderson1970"] },
  { key: "direccion", label: "Estrategia general y de negocio", desc: "Interpretación formal del cuadrante IE para los dueños: estrategia general y estrategias de negocio.", group: "direccion", step: "direccion", fields: ["direccion"], requires: ["foda"], icon: "flag", refs: ["david2017", "wheelen2018", "porter1980"] },
  { key: "ansoff", label: "Matriz de Ansoff", desc: "Opciones de crecimiento por producto y mercado.", group: "direccion", step: "portafolio", fields: ["ansoff"], icon: "arrows", refs: ["ansoff1957"] },
  { key: "estrategias", label: "Estrategias y KPI", desc: "Objetivos BSC, FODA cruzado con KPI y resumen ejecutivo.", group: "accion", step: "plan", fields: ["objetivos_estrategicos", "estrategias", "resumen_ejecutivo"], requires: ["foda"], icon: "target", refs: ["weihrich1982", "kaplan1996"] },
  { key: "informe_gestion", label: "Informe de gestión", desc: "Informe del plan estratégico empresarial: situación, diagnóstico, propuesta, implementación y control.", group: "informes", step: "informe", fields: ["informe_gestion"], requires: ["foda", "direccion", "estrategias"], icon: "report", refs: ["david2017", "kaplan1996"] },
  { key: "informe_ejecutivo", label: "Informe ejecutivo", desc: "Síntesis de una página para la gerencia: hallazgos, decisión y prioridades.", group: "informes", step: "informe", fields: ["informe_ejecutivo"], requires: ["foda", "direccion", "estrategias"], icon: "briefcase", refs: ["david2017"] },
  // ---- Fase III ----
  { key: "std", label: "Estrategias y tecnologías digitales", desc: "Agente 1 · Qué sistema o tecnología digital (S/TD) despliega cada estrategia, enlazado con visión, misión y objetivos.", group: "despliegue", step: "td_std", fields: ["std"], requires: ["identidad", "estrategias"], icon: "chip", refs: ["ward2016", "westerman2014"], agent: 1 },
  { key: "pareto", label: "Priorización por Pareto", desc: "Agente 2 · Puntúa cada estrategia con criterios ponderables y muestra qué pocas concentran la mayor contribución.", group: "despliegue", step: "td_pareto", fields: ["pareto"], requires: ["std"], icon: "pareto", refs: ["juran2010"], agent: 2 },
  { key: "presupuesto", label: "Presupuesto e inversión", desc: "Agente 3 · Estructura de costos de las S/TD priorizadas: inversión inicial y costos recurrentes.", group: "despliegue", step: "td_presupuesto", fields: ["presupuesto"], requires: ["pareto"], icon: "coins", refs: ["ward2016"], agent: 3 },
  { key: "kpis", label: "Indicadores de gestión (KPI)", desc: "Agente 4 · Ficha técnica de al menos un KPI por estrategia: fórmula, línea base, meta, fuente y responsable.", group: "despliegue", step: "td_kpis", fields: ["kpis"], requires: ["estrategias"], icon: "gauge", refs: ["parmenter2015", "kaplan1996"], agent: 4 },
  { key: "investigacion", label: "Investigación y operacionalización", desc: "Agente 5 · Literatura científica reciente en 4 áreas (≥12 referencias APA) y matriz de operacionalización de variables.", group: "investigacion", step: "td_investigacion", fields: ["literatura", "operacionalizacion"], icon: "flask", refs: ["hernandez2018", "apa2020"], agent: 5 },
  { key: "brechas", label: "Diagnóstico de brechas digitales", desc: "Agente 6 · Matriz de alineamiento entre el plan institucional y una política o marco de transformación digital.", group: "transformacion", step: "td_brechas", fields: ["brechas"], icon: "gap", refs: ["westerman2014"], agent: 6 },
  { key: "estrategias_td", label: "Estrategias de transformación digital", desc: "Agente 7 · Por cada lineamiento aplicable: estrategia, S/TD, justificación, beneficio e indicador.", group: "transformacion", step: "td_estrategias", fields: ["estrategias_td"], requires: ["brechas"], icon: "rocket", refs: ["ward2016", "westerman2014"], agent: 7 },
  { key: "informe_gestion_td", label: "Informe de gestión integrado", desc: "Agente 8 · Diagnóstico, objetivos, estrategias, S/TD, priorización, KPI, presupuesto, responsables y seguimiento.", group: "informes_td", step: "td_informe", fields: ["informe_gestion_td"], requires: ["std", "pareto", "presupuesto", "kpis"], icon: "report", refs: ["kaplan1996", "ward2016"], agent: 8 },
  { key: "informe_ejecutivo_td", label: "Informe ejecutivo integrado", desc: "Agente 8 · Hallazgos, decisiones, tecnologías prioritarias, inversión requerida y resultados esperados.", group: "informes_td", step: "td_informe", fields: ["informe_ejecutivo_td"], requires: ["std", "pareto", "presupuesto", "kpis"], icon: "briefcase", refs: ["ward2016"], agent: 8 },
];

export const ALL_MODULES = MODULES.map((m) => m.key);
/** Herramientas de la primera etapa (fases I y II). Son las de "Plan completo" y las de reportes antiguos sin lista. */
export const BASE_MODULES = MODULES.filter((m) => !m.agent).map((m) => m.key);
/** Agentes de la fase III, en orden. */
export const TD_MODULES = MODULES.filter((m) => m.agent).map((m) => m.key);
export const isTdModule = (k: ModuleKey) => !!moduleDefSafe(k)?.agent;
function moduleDefSafe(k: string) { return MODULES.find((m) => m.key === k); }
export const moduleDef = (k: ModuleKey) => MODULES.find((m) => m.key === k)!;
export const isModuleKey = (k: string): k is ModuleKey => ALL_MODULES.includes(k as ModuleKey);

export const PRESETS: { key: string; label: string; desc: string; modules: ModuleKey[] }[] = [
  { key: "completo", label: "Plan completo", desc: `Las ${BASE_MODULES.length} herramientas e informes · 6–9 min`, modules: BASE_MODULES },
  { key: "integral", label: "Plan + agentes S/TD", desc: `Plan completo y los ${TD_MODULES.length} agentes de la fase III · 12–18 min`, modules: ALL_MODULES },
  { key: "despliegue", label: "Despliegue con S/TD", desc: "Estrategias, S/TD, Pareto, presupuesto, KPI e informes · 8–11 min", modules: ["identidad", "estrategias", "std", "pareto", "presupuesto", "kpis", "informe_gestion_td", "informe_ejecutivo_td"] },
  { key: "brechas", label: "Brechas digitales", desc: "Diagnóstico frente a una política, propuestas e investigación · 5–7 min", modules: ["brechas", "estrategias_td", "investigacion"] },
  { key: "rapido", label: "Diagnóstico rápido", desc: "PESTEL, Porter y FODA · 2–3 min", modules: ["pestel", "porter", "foda"] },
  { key: "entorno", label: "Entorno y competencia", desc: "PESTEL, Porter y MPC · 2 min", modules: ["pestel", "porter", "mpc"] },
  { key: "situacion", label: "Situación actual", desc: "Fase I del sílabo: identidad, entorno y diagnóstico · 3–4 min", modules: ["identidad", "canvas", "cadena_valor", "pestel", "porter", "mpc", "foda", "bcg"] },
  { key: "modelo", label: "Modelo de negocio", desc: "Identidad, Canvas y cadena de valor · 2 min", modules: ["identidad", "canvas", "cadena_valor"] },
];

/** Filtra claves válidas, agrega dependencias y ordena como el catálogo. null/vacío → todas. */
export function normalizeModules(list: unknown): ModuleKey[] {
  const raw = Array.isArray(list) ? list.filter((k): k is ModuleKey => ALL_MODULES.includes(k as ModuleKey)) : [];
  if (!raw.length) return [...BASE_MODULES];
  const set = new Set(raw);
  const add = (k: ModuleKey) => { for (const r of moduleDef(k).requires ?? []) if (!set.has(r)) { set.add(r); add(r); } };
  raw.forEach(add);
  return ALL_MODULES.filter((k) => set.has(k));
}

export function parseModules(json: string | null | undefined): ModuleKey[] {
  if (!json) return [...BASE_MODULES];
  try { return normalizeModules(JSON.parse(json)); } catch { return [...BASE_MODULES]; }
}

export function moduleDone(k: ModuleKey, result: Pick<StrategicResult, "plan"> | null | undefined): boolean {
  const p = result?.plan;
  return !!p && moduleDef(k).fields.every((f) => p[f] != null);
}
