// Tipos de la fase III: agentes de despliegue de estrategias con sistemas y tecnologías digitales (S/TD),
// priorización, presupuesto, indicadores, investigación científica y transformación digital.

/**
 * Procedencia de cada dato, para que el usuario distinga qué puso él, qué salió de una fuente verificable,
 * qué es una estimación y qué es una propuesta del modelo de IA.
 */
export type Origen = "usuario" | "fuente" | "estimacion" | "ia";

// ---------- 1. Agente de estrategias y tecnologías digitales ----------
export type StdCategory =
  | "ERP y gestión" | "CRM y clientes" | "Comercio electrónico" | "BI y analítica" | "Inteligencia artificial"
  | "Nube e infraestructura" | "Ciberseguridad" | "Colaboración y gestión documental" | "Automatización de procesos"
  | "Redes y telecomunicaciones" | "Servicios digitales al ciudadano" | "Otro";
/** existente: ya lo tiene y basta usarlo; mejorar: lo tiene pero no alcanza; nueva: no lo tiene. */
export type StdSituation = "existente" | "mejorar" | "nueva";
export type StdRow = {
  /** Id de la estrategia del plan (E1, E2…), en el orden de plan.estrategias. */
  id: string;
  estrategia: string;
  objetivo: string;
  vinculo: string;
  std: string;
  categoria: StdCategory;
  situacion: StdSituation;
  capacidad_actual: string;
  finalidad: string;
  justificacion: string;
  aporte: string;
  origen: Origen;
};
export type StdMatrix = {
  alineacion: { vision: string; mision: string; lectura: string };
  capacidades_actuales: { sistema: string; uso: string; evidencia: string; origen: Origen }[];
  filas: StdRow[];
  conclusion: string;
};

// ---------- 2. Agente de priorización por Pareto ----------
export type ParetoCriterion = { key: string; nombre: string; descripcion: string; peso: number };
export type ParetoEvaluation = {
  id: string;
  puntajes: { criterio: string; valor: number; justificacion: string }[];
  datos_base: string;
  origen: Origen;
};
export type ParetoAnalysis = {
  metodo: string;
  criterios: ParetoCriterion[];
  evaluaciones: ParetoEvaluation[];
  limitaciones: string[];
  /** Corte de la clase A en % acumulado (por defecto 80). */
  corte?: number;
};

// ---------- 3. Agente de presupuesto e inversión ----------
export type BudgetCategory = "Hardware" | "Software" | "Licencias" | "Infraestructura" | "Desarrollo" | "Implementación" | "Capacitación" | "Mantenimiento" | "Personal" | "Otros";
export type BudgetLine = {
  id: string;
  /** Estrategia/S-TD a la que pertenece (E1…). */
  std_id: string;
  concepto: string;
  categoria: BudgetCategory;
  /** inicial = inversión de una vez; recurrente = costo operativo que se repite. */
  tipo: "inicial" | "recurrente";
  periodicidad: "unica" | "mensual" | "anual";
  cantidad: number;
  unidad: string;
  costo_unitario: number;
  origen: Origen;
  fuente_url: string;
  nota: string;
};
export type TechBudget = {
  moneda: string;
  /** Presupuesto disponible declarado por la organización (null si no se conoce). */
  disponible: number | null;
  horizonte_meses: number;
  partidas: BudgetLine[];
  supuestos: string[];
  limitaciones: string[];
};

// ---------- 4. Agente de indicadores (KPI) ----------
export type KpiKind = "Eficacia" | "Eficiencia" | "Efectividad" | "Productividad" | "Calidad" | "Otro";
export type KpiCard = {
  id: string;
  estrategia_id: string;
  estrategia: string;
  objetivo: string;
  nombre: string;
  tipo: KpiKind;
  justificacion_tipo: string;
  def_conceptual: string;
  def_operacional: string;
  formula: string;
  unidad: string;
  linea_base: string;
  /** pendiente: no hay dato y debe levantarse antes de fijar la meta. */
  linea_base_estado: "disponible" | "pendiente";
  meta: string;
  fuente: string;
  frecuencia: string;
  responsable: string;
  coherencia: string;
  origen: Origen;
};
export type KpiDesign = { indicadores: KpiCard[]; datos_solicitados: string[] };

// ---------- 5. Agente de investigación científica ----------
export type ResearchArea = 1 | 2 | 3 | 4;
export type ScientificBase = "Scopus" | "Web of Science" | "MDPI" | "IEEE" | "Springer" | "ProQuest" | "Otra";
export type ScientificRef = {
  id: string;
  area: ResearchArea;
  /** En formato APA: "Pérez, J., Gómez, L., y Ruiz, A." */
  autores: string;
  anio: number;
  titulo: string;
  revista: string;
  volumen: string;
  numero: string;
  paginas: string;
  doi: string;
  url: string;
  bases: ScientificBase[];
  /** consultada: el agente abrió la página del artículo; sugerida: debe verificarse antes de citarla. */
  estado: "consultada" | "sugerida";
  aporte: string;
};
export type Literature = { consultas: string[]; referencias: ScientificRef[]; nota: string };
export type OpVariable = {
  nombre: string;
  tipo: "independiente" | "dependiente" | "interviniente";
  def_conceptual: string;
  refs_conceptual: string[];
  def_operacional: string;
  dimensiones: { nombre: string; indicadores: string[]; refs: string[] }[];
};
export type Operationalization = { problema: string; variables: OpVariable[] };

// ---------- 6. Agente de diagnóstico y brechas ----------
/** 0 sin correspondencia · 1 baja · 2 parcial · 3 alta. */
export type AlignLevel = 0 | 1 | 2 | 3;
export type GapRow = {
  id: string;
  eje: string;
  lineamiento: string;
  objetivo_institucional: string;
  situacion_actual: string;
  evidencia: string;
  evidencia_fuente: string;
  nivel: AlignLevel;
  brecha: string;
  necesidad: string;
  problema: string;
  origen: Origen;
};
export type GapDiagnosis = {
  documento_institucional: string;
  documento_referencia: string;
  filas: GapRow[];
  problemas: { id: string; tipo: "general" | "especifico"; enunciado: string; lineamientos: string[]; evidencia: string }[];
  limitaciones: string[];
};

// ---------- 7. Agente de estrategias de transformación digital ----------
export type DigitalProposal = {
  id: string;
  lineamiento_id: string;
  lineamiento: string;
  aplica: boolean;
  motivo_no_aplica: string;
  necesidad: string;
  brecha: string;
  estrategia: string;
  std: string;
  justificacion: string;
  beneficio: string;
  indicador: string;
  exigencia: "baja" | "media" | "alta";
  horizonte: string;
  origen: Origen;
};
export type DigitalStrategies = { propuestas: DigitalProposal[]; conclusion: string };

// ---------- 8. Agente de informes ----------
export type TdManagementReport = {
  presentacion: string;
  diagnostico: string;
  objetivos_estrategias: string;
  tecnologias: string;
  priorizacion: string;
  indicadores: string;
  presupuesto: string;
  responsables: { rol: string; responsabilidad: string; estrategias: string[] }[];
  seguimiento: { mecanismo: string; frecuencia: string; responsable: string; instrumento: string }[];
  conclusiones: string[];
  recomendaciones: string[];
};
export type TdExecutiveReport = {
  situacion: string;
  hallazgos: string[];
  decisiones: string[];
  tecnologias_prioritarias: string[];
  inversion: string;
  resultados_esperados: string[];
  proximos_pasos: string[];
};

/** Documentos del análisis: el institucional (PEI, memoria…) y los de referencia (política o marco nacional). */
export type StrategicDocRow = {
  id: number; strategic_id: number; role: "institucional" | "referencia"; name: string;
  path: string | null; text_content: string | null; url: string | null; created_at: string;
};
