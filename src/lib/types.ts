import type { DigitalStrategies, GapDiagnosis, KpiDesign, Literature, Operationalization, ParetoAnalysis, StdMatrix, TdExecutiveReport, TdManagementReport, TechBudget } from "./td-types";
export * from "./td-types";

export type Company = {
  id: number; name: string; tax_id: string | null; industry: string | null;
  country: string; currency: string;
};
export type User = { id: number; company_id: number; email: string; name: string; role: string };
export type Product = {
  id: number; company_id: number; type: "producto" | "servicio"; name: string;
  brand: string | null; category: string | null; description: string | null;
  price: number; currency: string; sku: string | null; url: string | null;
  keywords: string | null; created_at: string;
};
export type AnalysisRow = {
  id: number; product_id: number; company_id: number;
  status: "queued" | "running" | "completed" | "failed";
  provider: string | null; created_at: string; started_at: string | null;
  finished_at: string | null; error: string | null; result_json: string | null;
  reviewed_by: string | null; reviewed_at: string | null;
};
export type OfferRow = {
  id: number; analysis_id: number; competitor: string; product_title: string | null;
  price: number; currency: string; url: string | null; rating: number | null;
  availability: string | null; features: string | null; match_score: number | null;
  scraped_at: string; anomaly: string | null;
};
export type LogRow = { id: number; analysis_id: number; ts: string; step: string; level: string; message: string };

export type Position = "cheaper" | "market" | "expensive";
export const POSITION_LABEL: Record<Position, string> = {
  cheaper: "Más barato",
  market: "En mercado",
  expensive: "Más caro",
};

export type Stats = {
  ownPrice: number; currency: string; count: number;
  min: number; max: number; avg: number; median: number;
  priceIndex: number; // propio / promedio * 100
  percentile: number; // % de competidores con precio menor al propio
  position: Position;
};

export type SwotAnalysis = { fortalezas: string[]; debilidades: string[]; oportunidades: string[]; amenazas: string[] };
export type Recommendation = { titulo: string; detalle: string; prioridad: "alta" | "media" | "baja" };
export type Strategy = {
  resumen_ejecutivo: string;
  fortalezas: string[];
  debilidades: string[];
  foda: SwotAnalysis;
  recomendaciones: Recommendation[];
  precio_sugerido: number;
  justificacion_precio: string;
};
export type AnalysisResult = {
  stats: Stats | null;
  strategy: Strategy | null;
  queries: string[];
  rawOffers: number;
  keptOffers: number;
  /** Ofertas conservadas pero excluidas de las estadísticas por su precio atípico. */
  anomalies?: number;
  meta?: { costUsd?: number; durationMs?: number; provider?: string };
  warning?: string;
};

// ---- Análisis estratégico (misión, visión, PESTEL, Porter, FODA, EFI/EFE, estrategias con KPI) ----
export type StrategicRow = {
  id: number; company_id: number; subject_kind: "propia" | "externa"; subject_name: string;
  website_url: string | null; industry: string | null; country: string | null; notes: string | null;
  doc_name: string | null; doc_text: string | null; doc_path: string | null;
  status: "queued" | "running" | "completed" | "failed"; provider: string | null;
  created_at: string; started_at: string | null; finished_at: string | null;
  error: string | null; result_json: string | null;
  /** JSON con las herramientas elegidas (ModuleKey[]); null en reportes anteriores = todas. */
  modules: string | null;
  reviewed_by: string | null; reviewed_at: string | null;
};

/** Fuente web con los datos para citarla en APA 7 (autor, año y sitio faltan en reportes anteriores). */
export type Source = { titulo: string; url: string; autor?: string; anio?: string; sitio?: string };
export type Research = {
  perfil: {
    descripcion: string; sector: string; propuesta_valor: string; productos_servicios: string[];
    clientes_objetivo: string; presencia_digital: string; mision_declarada: string; vision_declarada: string;
  };
  hallazgos_documento: string[];
  competidores: { nombre: string; descripcion: string; url: string }[];
  entorno: { dimension: PestelDimension; dato: string; fuente_url: string }[];
  tendencias_sector: string[];
  fuentes: Source[];
};

export type PestelDimension = "politico" | "economico" | "social" | "tecnologico" | "ecologico" | "legal";
export type Level = "alta" | "media" | "baja";
export type BscPerspective = "Financiera" | "Clientes" | "Procesos internos" | "Aprendizaje y crecimiento";
export type IndicatorType = "Eficacia" | "Eficiencia" | "Efectividad" | "Calidad" | "Productividad" | "Financiero";
export type PorterForce = { intensidad: Level; puntaje: number; factores: string[] };
export type MatrixFactor = { factor: string; peso: number; calificacion: number };
export type Kpi = {
  nombre: string; formula: string; tipo_indicador: IndicatorType; perspectiva: BscPerspective;
  fuente_informacion: string; tipo_fuente: "Interna" | "Externa"; frecuencia: string;
  linea_base: string; meta: string;
};
export type StrategyItem = {
  tipo: "FO" | "FA" | "DO" | "DA"; titulo: string; descripcion: string; prioridad: Level; kpi: Kpi;
};
export type StrategicPlan = {
  resumen_ejecutivo: string;
  mision: { texto: string; justificacion: string };
  vision: { texto: string; justificacion: string };
  valores: string[];
  objetivos_estrategicos: { objetivo: string; perspectiva: BscPerspective; plazo: string }[];
  pestel: { dimension: PestelDimension; factor: string; impacto: Level; efecto: "oportunidad" | "amenaza" }[];
  porter: {
    rivalidad: PorterForce; nuevos_entrantes: PorterForce; sustitutos: PorterForce;
    poder_proveedores: PorterForce; poder_clientes: PorterForce; conclusion: string;
  };
  foda: SwotAnalysis;
  matriz_efi: { fortalezas: MatrixFactor[]; debilidades: MatrixFactor[] };
  matriz_efe: { oportunidades: MatrixFactor[]; amenazas: MatrixFactor[] };
  estrategias: StrategyItem[];
  canvas: Record<CanvasBlock, string[]>;
  /** procesos: 5 o más procesos principales por actividad (no existe en reportes anteriores). */
  cadena_valor: { actividad: string; tipo: "primaria" | "apoyo"; analisis: string; evaluacion: "ventaja" | "paridad" | "a mejorar"; procesos?: string[] }[];
  mpc: { factores: { factor: string; peso: number; calificaciones: { empresa: string; calificacion: number }[] }[]; conclusion: string };
  bcg: { unidades: BcgUnit[]; conclusion: string };
  ansoff: { penetracion: string[]; desarrollo_mercado: string[]; desarrollo_producto: string[]; diversificacion: string[]; recomendada: AnsoffKey; justificacion: string };
  direccion: StrategicDirection;
  informe_gestion: ManagementReport;
  informe_ejecutivo: ExecutiveReport;
  // ---- Fase III (ampliación): agentes de despliegue con S/TD, investigación y transformación digital (ver td-types.ts) ----
  std: StdMatrix;
  pareto: ParetoAnalysis;
  presupuesto: TechBudget;
  kpis: KpiDesign;
  literatura: Literature;
  operacionalizacion: Operationalization;
  brechas: GapDiagnosis;
  estrategias_td: DigitalStrategies;
  informe_gestion_td: TdManagementReport;
  informe_ejecutivo_td: TdExecutiveReport;
};
/** Estrategia corporativa según la dirección que marca la matriz IE (Wheelen y Hunger: crecimiento, estabilidad, reducción). */
export type GeneralStrategy = "Crecimiento" | "Estabilidad" | "Reducción";
export type GenericStrategy = "Liderazgo en costos" | "Diferenciación" | "Enfoque en costos" | "Enfoque en diferenciación";
export type BusinessStrategyCategory = "Intensiva" | "Integración" | "Diversificación" | "Defensiva";
/** De la posición en la matriz IE a la estrategia general y luego a las estrategias de negocio, para los dueños. */
export type StrategicDirection = {
  interpretacion: string;
  estrategia_general: { tipo: GeneralStrategy; fundamento: string };
  estrategia_competitiva: { tipo: GenericStrategy; fundamento: string };
  estrategias_negocio: { categoria: BusinessStrategyCategory; nombre: string; descripcion: string; acciones: string[]; horizonte: string }[];
  recomendacion: string;
};
export type ManagementReport = {
  presentacion: string;
  situacion_actual: string;
  diagnostico: string;
  propuesta: string;
  plan_implementacion: { accion: string; responsable: string; plazo: string; recursos: string; indicador: string }[];
  seguimiento: string;
  conclusiones: string[];
  recomendaciones: string[];
};
export type ExecutiveReport = {
  situacion: string;
  hallazgos: string[];
  decision: string;
  prioridades: string[];
  resultados_esperados: string;
  proximos_pasos: string[];
};
export type BcgQuadrant = "estrella" | "vaca" | "interrogante" | "perro";
export type BcgUnit = {
  unidad: string; crecimiento_mercado: number; participacion_relativa: number;
  /** Lo calcula el código a partir de los dos ejes (no se confía en el del modelo). */
  cuadrante: BcgQuadrant; base_estimacion: string; estrategia: string;
};
export type CanvasBlock = "socios_clave" | "actividades_clave" | "recursos_clave" | "propuesta_valor" | "relacion_clientes" | "canales" | "segmentos_clientes" | "estructura_costos" | "fuentes_ingreso";
export type AnsoffKey = "penetracion" | "desarrollo_mercado" | "desarrollo_producto" | "diversificacion";
/** Matriz Interna-Externa: celda I–IX según totales EFI (x) y EFE (y). */
export type IeResult = { cuadrante: number; estrategia: "Crecer y construir" | "Conservar y mantener" | "Cosechar o desinvertir" };
export type StrategicResult = {
  research: Research;
  /** Parcial: solo trae las herramientas elegidas (y se va llenando mientras el agente trabaja). */
  plan: Partial<StrategicPlan>;
  /** Solo si se corrió FODA. */
  efiTotal?: number;
  efeTotal?: number;
  /** Herramientas que el agente está generando en este momento. */
  running?: string[];
  /** Opcionales: reportes anteriores a estas herramientas no los tienen. */
  ie?: IeResult;
  mpcTotals?: { empresa: string; total: number }[];
  /** Herramientas revisadas y validadas por una persona (fase III): quién y cuándo. */
  validaciones?: Partial<Record<string, { por: string; fecha: string }>>;
  meta?: { costUsd?: number; durationMs?: number; provider?: string };
};
