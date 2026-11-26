import type { JsonSchema } from "./types";

const str = { type: "string" };
const strArr = { type: "array", items: { type: "string" } };

export const OFFERS_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["offers"],
  properties: {
    offers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["competitor", "product_title", "price", "currency", "url", "availability", "features", "match_score"],
        properties: {
          competitor: { ...str, description: "Nombre de la tienda o competidor" },
          product_title: { ...str, description: "Título del producto/servicio tal como aparece en la fuente" },
          price: { type: "number", description: "Precio numérico actual (sin símbolo de moneda)" },
          currency: { ...str, description: "Código ISO: PEN, USD, etc." },
          url: { ...str, description: "URL exacta de la página donde se vio el precio" },
          availability: { ...str, description: "Disponibilidad (en stock, agotado, sobre pedido...)" },
          features: { ...str, description: "Características clave en una frase corta" },
          rating: { type: "number", description: "Calificación de 0 a 5 si aparece en la fuente" },
          match_score: { type: "number", description: "0 a 1: qué tan comparable es con el producto propio" },
        },
      },
    },
  },
};

export const STRATEGY_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["resumen_ejecutivo", "fortalezas", "debilidades", "foda", "recomendaciones", "precio_sugerido", "justificacion_precio"],
  properties: {
    resumen_ejecutivo: str,
    fortalezas: strArr,
    debilidades: strArr,
    foda: {
      type: "object",
      additionalProperties: false,
      required: ["fortalezas", "debilidades", "oportunidades", "amenazas"],
      properties: { fortalezas: strArr, debilidades: strArr, oportunidades: strArr, amenazas: strArr },
    },
    recomendaciones: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["titulo", "detalle", "prioridad"],
        properties: { titulo: str, detalle: str, prioridad: { type: "string", enum: ["alta", "media", "baja"] } },
      },
    },
    precio_sugerido: { type: "number" },
    justificacion_precio: str,
  },
};

// ---- Análisis estratégico ----
const obj = (properties: Record<string, unknown>) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
const level = { type: "string", enum: ["alta", "media", "baja"] };
const pestelDim = { type: "string", enum: ["politico", "economico", "social", "tecnologico", "ecologico", "legal"] };
const bsc = { type: "string", enum: ["Financiera", "Clientes", "Procesos internos", "Aprendizaje y crecimiento"] };

export const RESEARCH_SCHEMA: JsonSchema = obj({
  perfil: obj({
    descripcion: { ...str, description: "Qué hace la organización, en 2-4 oraciones" },
    sector: str,
    propuesta_valor: str,
    productos_servicios: strArr,
    clientes_objetivo: str,
    presencia_digital: { ...str, description: "Web, redes, marketplaces, reseñas; lo observado" },
    mision_declarada: { ...str, description: "Misión publicada por la organización, textual; vacío si no se encontró" },
    vision_declarada: { ...str, description: "Visión publicada por la organización, textual; vacío si no se encontró" },
  }),
  hallazgos_documento: { ...strArr, description: "Datos clave extraídos del documento adjunto (vacío si no hay documento)" },
  competidores: { type: "array", items: obj({ nombre: str, descripcion: str, url: str }) },
  entorno: {
    type: "array",
    description: "Datos del macroentorno del país/sector, con la URL de donde salió cada dato",
    items: obj({ dimension: pestelDim, dato: str, fuente_url: str }),
  },
  tendencias_sector: strArr,
  fuentes: {
    type: "array",
    description: "Fuentes realmente consultadas, con los datos para citarlas en APA 7",
    items: obj({
      autor: { ...str, description: "Persona en formato APA (\"Apellido, N.\") u organización autora (\"Instituto Nacional de Estadística e Informática\")" },
      anio: { ...str, description: "Año de publicación (\"2025\"); \"s.f.\" si no tiene fecha" },
      titulo: str,
      sitio: { ...str, description: "Nombre del sitio web o medio" },
      url: str,
    }),
  },
});

const force = obj({
  intensidad: level,
  puntaje: { type: "number", description: "1 (muy baja) a 5 (muy alta)" },
  factores: strArr,
});
const factor = obj({
  factor: str,
  peso: { type: "number", description: "0 a 1; los pesos de toda la matriz suman 1" },
  calificacion: { type: "number", description: "1 a 4" },
});

// La síntesis se pide en varios pasos con esquemas pequeños: un único esquema con todas las herramientas
// supera el tamaño de gramática que admite la salida estructurada de la API ("compiled grammar is too large").
const arr = (items: unknown, description?: string) => ({ type: "array", items, ...(description ? { description } : {}) });
const CANVAS_KEYS = ["socios_clave", "actividades_clave", "recursos_clave", "propuesta_valor", "relacion_clientes", "canales", "segmentos_clientes", "estructura_costos", "fuentes_ingreso"];

/** Paso 1: identidad y modelo de negocio. */
export const IDENTITY_SCHEMA: JsonSchema = obj({
  mision: obj({ texto: str, justificacion: str }),
  vision: obj({ texto: str, justificacion: str }),
  valores: strArr,
  canvas: obj(Object.fromEntries(CANVAS_KEYS.map((k) => [k, strArr]))),
  cadena_valor: arr(obj({
    actividad: str,
    tipo: { type: "string", enum: ["primaria", "apoyo"] },
    analisis: str,
    evaluacion: { type: "string", enum: ["ventaja", "paridad", "a mejorar"] },
    procesos: { ...strArr, description: "Al menos 5 procesos principales de esta actividad, concretos para la organización" },
  })),
});

/** Paso 2: entorno y competencia. */
export const ENVIRONMENT_SCHEMA: JsonSchema = obj({
  pestel: arr(obj({ dimension: pestelDim, factor: str, impacto: level, efecto: { type: "string", enum: ["oportunidad", "amenaza"] } })),
  porter: obj({
    rivalidad: force, nuevos_entrantes: force, sustitutos: force,
    poder_proveedores: force, poder_clientes: force, conclusion: str,
  }),
  mpc: obj({
    factores: arr(obj({
      factor: str,
      peso: { type: "number", description: "0 a 1; los pesos suman 1" },
      calificaciones: arr(obj({ empresa: str, calificacion: { type: "number", description: "1 a 4" } })),
    })),
    conclusion: str,
  }),
});

/** Paso 3: FODA y matrices de evaluación de factores. */
export const SWOT_SCHEMA: JsonSchema = obj({
  foda: obj({ fortalezas: strArr, debilidades: strArr, oportunidades: strArr, amenazas: strArr }),
  matriz_efi: obj({ fortalezas: arr(factor), debilidades: arr(factor) }),
  matriz_efe: obj({ oportunidades: arr(factor), amenazas: arr(factor) }),
});

/** Paso 4: portafolio (BCG) y crecimiento (Ansoff). */
export const PORTFOLIO_SCHEMA: JsonSchema = obj({
  bcg: obj({
    unidades: arr(obj({
      unidad: { ...str, description: "Línea de producto o unidad de negocio" },
      crecimiento_mercado: { type: "number", description: "Crecimiento anual estimado del mercado de esa línea, en %" },
      participacion_relativa: { type: "number", description: "Participación propia ÷ la del líder (1 = igual al líder)" },
      base_estimacion: { ...str, description: "En qué datos se apoya la estimación" },
      estrategia: str,
    })),
    conclusion: str,
  }),
  ansoff: obj({
    penetracion: strArr, desarrollo_mercado: strArr, desarrollo_producto: strArr, diversificacion: strArr,
    recomendada: { type: "string", enum: ["penetracion", "desarrollo_mercado", "desarrollo_producto", "diversificacion"] },
    justificacion: str,
  }),
});

/** Paso 5: de la matriz IE a la estrategia general y a las estrategias de negocio. */
export const DIRECTION_SCHEMA: JsonSchema = obj({
  direccion: obj({
    interpretacion: { ...str, description: "Interpretación formal del cuadrante IE dirigida a los dueños, con citas APA" },
    estrategia_general: obj({ tipo: { type: "string", enum: ["Crecimiento", "Estabilidad", "Reducción"] }, fundamento: str }),
    estrategia_competitiva: obj({ tipo: { type: "string", enum: ["Liderazgo en costos", "Diferenciación", "Enfoque en costos", "Enfoque en diferenciación"] }, fundamento: str }),
    estrategias_negocio: arr(obj({
      categoria: { type: "string", enum: ["Intensiva", "Integración", "Diversificación", "Defensiva"] },
      nombre: { ...str, description: "Estrategia concreta, p. ej. Penetración de mercado, Integración hacia adelante, Atrincheramiento" },
      descripcion: str,
      acciones: strArr,
      horizonte: str,
    })),
    recomendacion: { ...str, description: "Recomendación final a los dueños del negocio" },
  }),
});

/** Paso 7: informe de gestión del plan estratégico e informe ejecutivo. */
export const REPORT_SCHEMA: JsonSchema = obj({
  informe_gestion: obj({
    presentacion: str,
    situacion_actual: str,
    diagnostico: str,
    propuesta: str,
    plan_implementacion: arr(obj({ accion: str, responsable: str, plazo: str, recursos: str, indicador: str })),
    seguimiento: str,
    conclusiones: strArr,
    recomendaciones: strArr,
  }),
  informe_ejecutivo: obj({
    situacion: str,
    hallazgos: strArr,
    decision: str,
    prioridades: strArr,
    resultados_esperados: str,
    proximos_pasos: strArr,
  }),
});

/** Paso 6: objetivos, estrategias FODA cruzadas con KPI y resumen ejecutivo. */
export const PLAN_SCHEMA: JsonSchema = obj({
  resumen_ejecutivo: str,
  objetivos_estrategicos: arr(obj({ objetivo: str, perspectiva: bsc, plazo: str })),
  estrategias: arr(obj({
    tipo: { type: "string", enum: ["FO", "FA", "DO", "DA"] },
    titulo: str,
    descripcion: str,
    prioridad: level,
    kpi: obj({
      nombre: str,
      formula: { ...str, description: "Cómo se calcula, p. ej. (ventas online / ventas totales) × 100" },
      tipo_indicador: { type: "string", enum: ["Eficacia", "Eficiencia", "Efectividad", "Calidad", "Productividad", "Financiero"] },
      perspectiva: bsc,
      fuente_informacion: { ...str, description: "De dónde se obtendrá el dato concreto (sistema, reporte, encuesta, fuente pública)" },
      tipo_fuente: { type: "string", enum: ["Interna", "Externa"] },
      frecuencia: str,
      linea_base: str,
      meta: str,
    }),
  })),
});

/** Esquema de un paso reducido a las claves pedidas (el usuario elige qué herramientas correr). */
export function pickSchema(schema: JsonSchema, keys: string[]): JsonSchema {
  const props = schema.properties as Record<string, unknown>;
  return obj(Object.fromEntries(keys.filter((k) => k in props).map((k) => [k, props[k]])));
}
