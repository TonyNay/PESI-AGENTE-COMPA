// Esquemas de salida de los agentes de la fase III. Cada agente tiene su propio esquema pequeño
// (la salida estructurada rechaza gramáticas demasiado grandes).
import type { JsonSchema } from "./types";

const str = { type: "string" };
const strArr = { type: "array", items: str };
const num = { type: "number" };
const obj = (properties: Record<string, unknown>) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
const arr = (items: unknown, description?: string) => ({ type: "array", items, ...(description ? { description } : {}) });
const en = (values: readonly (string | number)[], description?: string) => ({ type: typeof values[0] === "number" ? "integer" : "string", enum: values, ...(description ? { description } : {}) });
const origen = en(["usuario", "fuente", "estimacion", "ia"], "usuario: lo dio la organización (notas/documento); fuente: dato con URL verificable; estimacion: valor aproximado; ia: propuesta del agente");

const STD_CATEGORIES = ["ERP y gestión", "CRM y clientes", "Comercio electrónico", "BI y analítica", "Inteligencia artificial", "Nube e infraestructura", "Ciberseguridad", "Colaboración y gestión documental", "Automatización de procesos", "Redes y telecomunicaciones", "Servicios digitales al ciudadano", "Otro"] as const;

export const STD_SCHEMA: JsonSchema = obj({
  std: obj({
    alineacion: obj({
      vision: str, mision: str,
      lectura: { ...str, description: "Cómo la cadena visión → misión → objetivos → estrategias → S/TD sostiene el rumbo de la organización (1 párrafo)" },
    }),
    capacidades_actuales: arr(obj({
      sistema: { ...str, description: "Sistema o herramienta digital que la organización YA usa" },
      uso: str,
      evidencia: { ...str, description: "Dónde se observó (sitio web, documento, notas) o \"no verificado\"" },
      origen,
    }), "Capacidades digitales actuales observadas; vacío si no hay evidencia"),
    filas: arr(obj({
      id: { ...str, description: "Id de la estrategia tal como viene en la lista (E1, E2…)" },
      estrategia: str,
      objetivo: { ...str, description: "Objetivo estratégico al que contribuye (texto de la lista de objetivos)" },
      vinculo: { ...str, description: "Cómo conecta con la misión y la visión, en una oración" },
      std: { ...str, description: "Sistema o tecnología digital concreta (tipo de solución, no una marca salvo que ya la use)" },
      categoria: en(STD_CATEGORIES),
      situacion: en(["existente", "mejorar", "nueva"], "existente: ya la tiene y basta usarla; mejorar: la tiene pero no alcanza; nueva: no la tiene"),
      capacidad_actual: { ...str, description: "Qué tiene hoy la organización para esto (o \"sin evidencia\")" },
      finalidad: str, justificacion: str,
      aporte: { ...str, description: "Aporte esperado a la organización, medible si es posible" },
      origen,
    })),
    conclusion: str,
  }),
});

export const PARETO_SCHEMA: JsonSchema = obj({
  pareto: obj({
    metodo: { ...str, description: "Cómo se puntuó: escala 1-5, criterios y de qué datos salen los puntajes" },
    criterios: arr(obj({
      key: en(["impacto", "urgencia", "contribucion", "recursos", "viabilidad"]),
      nombre: str, descripcion: { ...str, description: "Qué significa 1 y qué significa 5 en este criterio" },
      peso: { ...num, description: "Ponderación propuesta 0 a 1; todas suman 1" },
    })),
    evaluaciones: arr(obj({
      id: { ...str, description: "Id de la estrategia (E1…)" },
      puntajes: arr(obj({ criterio: en(["impacto", "urgencia", "contribucion", "recursos", "viabilidad"]), valor: { ...num, description: "1 a 5" }, justificacion: { ...str, description: "Dato o razón concreta que sustenta el puntaje" } })),
      datos_base: { ...str, description: "Datos del análisis previo en que se apoya la evaluación" },
      origen,
    })),
    limitaciones: strArr,
  }),
});

export const BUDGET_SCHEMA: JsonSchema = obj({
  presupuesto: obj({
    moneda: { ...str, description: "Código ISO, p. ej. PEN" },
    horizonte_meses: { ...num, description: "Horizonte para costear lo recurrente, normalmente 12" },
    partidas: arr(obj({
      id: str,
      std_id: { ...str, description: "Id de la estrategia/S-TD (E1…)" },
      concepto: str,
      categoria: en(["Hardware", "Software", "Licencias", "Infraestructura", "Desarrollo", "Implementación", "Capacitación", "Mantenimiento", "Personal", "Otros"]),
      tipo: en(["inicial", "recurrente"]),
      periodicidad: en(["unica", "mensual", "anual"], "unica para inversión inicial"),
      cantidad: num, unidad: str,
      costo_unitario: { ...num, description: "Precio por unidad en la moneda indicada (sin IGV salvo que se diga)" },
      origen: en(["fuente", "estimacion", "usuario"], "fuente SOLO si el precio se vio en una página pública cuya URL va en fuente_url"),
      fuente_url: { ...str, description: "URL exacta donde se vio el precio; vacío si es estimación" },
      nota: { ...str, description: "Supuesto o base del cálculo" },
    })),
    supuestos: strArr,
    limitaciones: strArr,
  }),
});

export const KPI_SCHEMA: JsonSchema = obj({
  kpis: obj({
    indicadores: arr(obj({
      id: str,
      estrategia_id: { ...str, description: "Id de la estrategia (E1…)" },
      estrategia: str, objetivo: str, nombre: str,
      tipo: en(["Eficacia", "Eficiencia", "Efectividad", "Productividad", "Calidad", "Otro"]),
      justificacion_tipo: str,
      def_conceptual: { ...str, description: "Qué mide y por qué importa" },
      def_operacional: { ...str, description: "Cómo se obtiene en la práctica: qué se cuenta, de qué registro, con qué periodo" },
      formula: str, unidad: str,
      linea_base: { ...str, description: "Valor actual SOLO si consta en los datos; si no, \"Pendiente de determinación\"" },
      linea_base_estado: en(["disponible", "pendiente"]),
      meta: { ...str, description: "Meta propuesta con plazo; si no hay línea base, indicar que es provisional" },
      fuente: { ...str, description: "Sistema, registro o fuente concreta de donde salen TODAS las variables de la fórmula" },
      frecuencia: str,
      responsable: { ...str, description: "Cargo responsable del seguimiento" },
      coherencia: { ...str, description: "Por qué la fuente permite calcular la fórmula" },
      origen,
    })),
    datos_solicitados: { ...strArr, description: "Datos que la organización debe entregar para completar líneas base" },
  }),
});

export const LITERATURE_SCHEMA: JsonSchema = obj({
  literatura: obj({
    consultas: { ...strArr, description: "Consultas de búsqueda realizadas" },
    referencias: arr(obj({
      id: str,
      area: en([1, 2, 3, 4], "1 gobierno y gestión; 2 SI, ingeniería de software y procesos; 3 big data, IA, ciencia de datos y BD; 4 telecomunicaciones, redes y seguridad"),
      autores: { ...str, description: "Autores en formato APA: \"Apellido, N., Apellido, N., y Apellido, N.\" tal como figuran en la publicación" },
      anio: num, titulo: str, revista: str, volumen: str, numero: str, paginas: { ...str, description: "Páginas o número de artículo; vacío si no consta" },
      doi: { ...str, description: "DOI tal como figura en la publicación (10.xxxx/...); vacío si no se vio" },
      url: { ...str, description: "URL de la página del artículo que se abrió" },
      bases: arr(en(["Scopus", "Web of Science", "MDPI", "IEEE", "Springer", "ProQuest", "Otra"]), "Bases o editoriales donde se constató la publicación"),
      estado: en(["consultada", "sugerida"], "consultada SOLO si se abrió la página del artículo y se vieron sus datos; si no, sugerida"),
      aporte: { ...str, description: "Qué aporta al estudio (variables, dimensiones, hallazgos)" },
    })),
    nota: str,
  }),
});

export const OPERATIONALIZATION_SCHEMA: JsonSchema = obj({
  operacionalizacion: obj({
    problema: { ...str, description: "Problema o tema de investigación al que responden las variables" },
    variables: arr(obj({
      nombre: str,
      tipo: en(["independiente", "dependiente", "interviniente"]),
      def_conceptual: str,
      refs_conceptual: { ...strArr, description: "Ids de las referencias (R1…) que sustentan la definición" },
      def_operacional: str,
      dimensiones: arr(obj({ nombre: str, indicadores: strArr, refs: { ...strArr, description: "Ids de las referencias de donde se derivó la dimensión" } })),
    })),
  }),
});

export const GAPS_SCHEMA: JsonSchema = obj({
  brechas: obj({
    documento_institucional: { ...str, description: "Nombre del documento institucional analizado" },
    documento_referencia: { ...str, description: "Nombre de la política, estrategia o marco de referencia" },
    filas: arr(obj({
      id: str,
      eje: { ...str, description: "Eje, objetivo prioritario o dimensión del documento de referencia" },
      lineamiento: { ...str, description: "Lineamiento tal como lo establece el documento de referencia (resumido fielmente)" },
      objetivo_institucional: { ...str, description: "Objetivo o acción del plan institucional relacionada; \"no se identifica\" si no hay" },
      situacion_actual: str,
      evidencia: { ...str, description: "Cita breve o dato del documento que sustenta la situación" },
      evidencia_fuente: { ...str, description: "Documento y sección/página de la evidencia" },
      nivel: en([0, 1, 2, 3], "0 sin correspondencia, 1 baja, 2 parcial, 3 alta"),
      brecha: str, necesidad: str,
      problema: { ...str, description: "Posible problema de investigación derivado de la brecha" },
      origen,
    })),
    problemas: arr(obj({
      id: str, tipo: en(["general", "especifico"]), enunciado: str,
      lineamientos: { ...strArr, description: "Ids de las filas (L1…) que lo sustentan" },
      evidencia: str,
    })),
    limitaciones: strArr,
  }),
});

export const DIGITAL_SCHEMA: JsonSchema = obj({
  estrategias_td: obj({
    propuestas: arr(obj({
      id: str,
      lineamiento_id: { ...str, description: "Id de la fila del diagnóstico (L1…)" },
      lineamiento: str,
      aplica: { type: "boolean", description: "false si el lineamiento no requiere una solución tecnológica propia" },
      motivo_no_aplica: { ...str, description: "Si aplica es false: por qué (p. ej. ya se cubre con otra propuesta o es normativo); si no, vacío" },
      necesidad: str, brecha: str, estrategia: str,
      std: { ...str, description: "Sistema o tecnología digital sugerida, acorde a las capacidades de la institución" },
      justificacion: { ...str, description: "Justificación técnica y estratégica" },
      beneficio: str,
      indicador: { ...str, description: "Indicador de seguimiento con su fórmula" },
      exigencia: en(["baja", "media", "alta"], "Exigencia de recursos y capacidades para implementarla"),
      horizonte: str,
      origen,
    })),
    conclusion: str,
  }),
});

export const TD_REPORT_SCHEMA: JsonSchema = obj({
  informe_gestion_td: obj({
    presentacion: str, diagnostico: str, objetivos_estrategias: str, tecnologias: str, priorizacion: str, indicadores: str, presupuesto: str,
    responsables: arr(obj({ rol: str, responsabilidad: str, estrategias: { ...strArr, description: "Ids E1…" } })),
    seguimiento: arr(obj({ mecanismo: str, frecuencia: str, responsable: str, instrumento: str })),
    conclusiones: strArr, recomendaciones: strArr,
  }),
  informe_ejecutivo_td: obj({
    situacion: str, hallazgos: strArr, decisiones: strArr, tecnologias_prioritarias: strArr,
    inversion: { ...str, description: "Inversión requerida usando EXACTAMENTE los totales calculados" },
    resultados_esperados: strArr, proximos_pasos: strArr,
  }),
});

export function pickTd(schema: JsonSchema, keys: string[]): JsonSchema {
  const props = schema.properties as Record<string, unknown>;
  return obj(Object.fromEntries(keys.filter((k) => k in props).map((k) => [k, props[k]])));
}
