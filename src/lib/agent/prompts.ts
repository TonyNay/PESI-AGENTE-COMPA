import { TD_THEORY_IDS, THEORY, referenceList, refText } from "../apa";
import type { Company, Product, Research, Stats, StrategicRow } from "../types";
import type { NormalizedOffer } from "./normalize";

export function buildQueries(p: Product, c: Company): string[] {
  const kw = (p.keywords || "").split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  const base = [p.brand, p.name].filter(Boolean).join(" ").replace(/\s+/g, " ");
  const base2 = p.name.includes(p.brand || "\u0000") ? p.name : base;
  const country = c.country || "Perú";
  const q: string[] = [];
  if (p.type === "servicio") {
    q.push(`${p.name} precio ${country}`, `${p.name} costo tarifa ${country}`, `${p.name} cotizar empresas ${country}`);
  } else {
    q.push(`${base2} precio ${country}`, `${base2} comprar ${country} tienda`, `${base2} oferta precio S/ ${country === "Perú" ? "" : country}`.trim());
    if (p.sku) q.push(`${p.sku} ${p.brand || ""} precio ${country}`.replace(/\s+/g, " "));
  }
  if (kw.length) q.push(`${kw.slice(0, 3).join(" ")} ${p.category || ""} precio ${country}`.replace(/\s+/g, " ").trim());
  return [...new Set(q)].slice(0, 5);
}

export function scrapingPrompt(p: Product, c: Company, queries: string[], alreadyFound?: string[]): string {
  const ctx = { name: p.name, price: p.price, currency: p.currency, type: p.type };
  return `Eres un analista de inteligencia competitiva. Tu tarea es encontrar OFERTAS REALES y ACTUALES de la competencia para el siguiente ${p.type} de la empresa "${c.name}" (${c.industry || "retail"}, ${c.country}).

PRODUCTO PROPIO
- Nombre: ${p.name}
- Marca: ${p.brand || "n/d"} | Categoría: ${p.category || "n/d"} | SKU: ${p.sku || "n/d"}
- Descripción: ${p.description || "n/d"}
- Precio propio: ${p.currency} ${p.price}

INSTRUCCIONES
1. Usa la herramienta WebSearch con consultas como estas (puedes adaptarlas):
${queries.map((q) => `   - ${q}`).join("\n")}
2. Prioriza tiendas y competidores de ${c.country} con precios en ${p.currency} (por ejemplo retailers, marketplaces y tiendas especializadas locales). Usa WebFetch para abrir las páginas de producto y confirmar el precio real.
3. Realiza varias búsquedas distintas (al menos 3) y abre al menos 6 páginas de producto de DISTINTAS tiendas (por ejemplo Falabella, Ripley, Oechsle, Plaza Vea, Mercado Libre, Hiraoka, Promart, Coolbox, Tottus, Linio, o tiendas oficiales de la marca). Objetivo: entre 6 y 10 ofertas verificadas. Cada oferta debe tener la URL exacta de la página donde viste el precio. Las páginas de listado de marketplaces (p. ej. Falabella /shop/, Plaza Vea /lbc/) son válidas: si muestran varios vendedores con precio, reporta cada vendedor como una oferta (competitor = "Tienda (vendedor)"). No repitas la misma oferta.
4. NO inventes precios, tiendas ni URLs. Algunas tiendas bloquean el acceso automatizado (HTTP 403, p. ej. Ripley o Hiraoka): en ese caso puedes usar el precio que aparece en el resultado de WebSearch para esa URL, poniendo en availability "Precio tomado del resultado de búsqueda (no verificado en la página)". Nunca incluyas un precio que no hayas visto en una página o en un resultado de búsqueda. No intentes evadir bloqueos, CAPTCHA, inicios de sesión ni muros de pago. Extrae solo datos fácticos: no copies fotografías, reseñas ni textos de marketing; resume las características con tus palabras.
5. match_score (0 a 1) indica qué tan comparable es la oferta con el producto propio (mismo modelo/capacidad = 0.9-1; variante cercana = 0.6-0.8; producto distinto = menos de 0.5).
6. price es un número (sin símbolos) y currency un código ISO (PEN, USD...). Reporta el precio vigente al público (con descuento si aplica, no el de lista tachado).
7. features: una frase corta con características clave de la oferta (garantía, envío, especificaciones relevantes).
8. Responde únicamente con el JSON según el esquema solicitado.

${alreadyFound ? `\nBÚSQUEDA AMPLIADA: una primera búsqueda encontró muy pocas ofertas${alreadyFound.length ? ` (ya tenemos: ${[...new Set(alreadyFound)].join(", ")})` : ""}. Busca en OTRAS tiendas y marketplaces, prueba variantes del nombre (sin capacidad, con código de modelo, en inglés) y modelos equivalentes cercanos (match_score 0.6-0.8). Sigue sin inventar datos.\n` : ""}
CONTEXT_JSON: ${JSON.stringify(ctx)}`;
}

export function strategyPrompt(p: Product, c: Company, stats: Stats, offers: NormalizedOffer[]): string {
  const ctx = { name: p.name, price: p.price, currency: p.currency, type: p.type, stats };
  const list = offers
    .map((o) => `- ${o.competitor}: ${o.currency} ${o.price} | ${o.product_title} | ${o.availability || "n/d"} | ${o.features || ""} | ${o.url}`)
    .join("\n");
  return `Eres un consultor senior de estrategia comercial y pricing. Redacta en ESPAÑOL un análisis estratégico para la empresa "${c.name}" (${c.industry || "retail"}, ${c.country}) sobre su ${p.type} "${p.name}".

DATOS DEL PRODUCTO PROPIO
- Precio propio: ${p.currency} ${p.price} | Marca: ${p.brand || "n/d"} | Categoría: ${p.category || "n/d"}
- Descripción: ${p.description || "n/d"}

ESTADÍSTICAS DE MERCADO (calculadas sobre ${stats.count} ofertas, en ${stats.currency})
- Mínimo ${stats.min} | Máximo ${stats.max} | Promedio ${stats.avg} | Mediana ${stats.median}
- Índice de precio (propio/promedio*100): ${stats.priceIndex} | Percentil: ${stats.percentile}% de competidores son más baratos | Posición: ${stats.position}

OFERTAS DE LA COMPETENCIA
${list}

Entrega: resumen ejecutivo (3-5 oraciones con cifras), fortalezas y debilidades (3-5 puntos c/u, basados en los datos), análisis FODA, 3-5 recomendaciones accionables priorizadas (alta/media/baja) y un precio sugerido numérico en ${stats.currency} con su justificación. Basa todo en los datos; no inventes cifras que no estén arriba. No necesitas buscar en la web.

CONTEXT_JSON: ${JSON.stringify(ctx)}`;
}

// ---- Análisis estratégico ----

/** Datos internos que Compa ya tiene de la empresa (solo cuando se analiza a sí misma). */
export type InternalContext = {
  company: Company;
  products: Product[];
  /** Una línea por producto con el último análisis de precios completado. */
  priceLines: string[];
  competitors: string[];
};

const DOC_IN_PROMPT = 6000;

function subjectBlock(s: StrategicRow): string {
  return `ORGANIZACIÓN A ANALIZAR
- Nombre: ${s.subject_name}
- Sitio web: ${s.website_url || "n/d"}
- Sector declarado: ${s.industry || "n/d"} | País: ${s.country || "n/d"}
- Notas del usuario: ${s.notes || "n/d"}`;
}

function internalBlock(ctx?: InternalContext): string {
  if (!ctx) return "";
  const items = ctx.products.map((p) => `- [${p.type}] ${p.name}${p.brand ? ` (${p.brand})` : ""}: ${p.currency} ${p.price}${p.category ? ` · ${p.category}` : ""}`).join("\n");
  return `
DATOS INTERNOS (registrados en la plataforma Compa por la propia empresa)
Catálogo (${ctx.products.length} ítems):
${items || "- sin ítems"}
Resultados de la herramienta de inteligencia de precios de Compa (último análisis por producto):
${ctx.priceLines.length ? ctx.priceLines.join("\n") : "- aún no hay análisis de precios completados"}
Competidores detectados en esos análisis: ${ctx.competitors.join(", ") || "n/d"}
`;
}

export function researchPrompt(s: StrategicRow, ctx: InternalContext | undefined, attachedFile?: string): string {
  const doc = s.doc_text
    ? `\nDOCUMENTO ENTREGADO POR EL USUARIO ("${s.doc_name}"), primeros ${DOC_IN_PROMPT} caracteres:\n"""\n${s.doc_text.slice(0, DOC_IN_PROMPT)}\n"""\n`
    : attachedFile
      ? `\nDOCUMENTO ENTREGADO POR EL USUARIO: "${attachedFile}" (adjunto al mensaje; si no lo ves, ábrelo con la herramienta Read desde el directorio de trabajo). Extrae sus datos clave.\n`
      : "";
  return `Eres un analista de planeamiento estratégico. Investiga a la siguiente organización y su entorno para preparar un diagnóstico estratégico (misión, visión, PESTEL, cinco fuerzas de Porter, FODA).

${subjectBlock(s)}
${internalBlock(ctx)}${doc}
INSTRUCCIONES
1. ${s.website_url ? `Abre el sitio web ${s.website_url} con WebFetch (inicio y, si existen, "nosotros"/"quiénes somos"/"about") para conocer qué hace, su oferta, su propuesta de valor y si publica misión o visión.` : "Busca con WebSearch el sitio web oficial y perfiles públicos de la organización y ábrelos con WebFetch."}
2. Busca con WebSearch (al menos 3 consultas) información del sector en ${s.country || "su país"}: principales competidores, tamaño y crecimiento del mercado, tendencias, regulación relevante y datos macroeconómicos recientes (inflación, crecimiento, tipo de cambio, consumo, digitalización).
3. En "entorno" incluye entre 6 y 12 datos concretos y recientes, cada uno con su dimensión PESTEL y la URL exacta de donde lo sacaste.
4. En "competidores" incluye entre 3 y 6 competidores reales con su URL.
5. Si hay documento, resume en "hallazgos_documento" entre 5 y 15 datos clave (cifras, metas, problemas, clientes, procesos). Si no hay documento, deja la lista vacía.
6. mision_declarada y vision_declarada: cópialas textualmente solo si la organización las publica; si no, deja "".
7. En "fuentes" lista entre 5 y 12 fuentes que realmente consultaste, con los datos para citarlas en APA 7: autor (persona como "Apellido, N." u organización autora con su nombre completo, p. ej. "Banco Central de Reserva del Perú"), año de publicación ("s.f." si no tiene fecha), título de la página o documento, nombre del sitio y URL exacta. Cada "fuente_url" de "entorno" debe estar en esta lista.
8. NO inventes datos, cifras ni URLs. Si algo no se encuentra, dilo ("no encontrado"). Responde en ESPAÑOL y únicamente con el JSON del esquema.

CONTEXT_JSON: ${JSON.stringify({ name: s.subject_name, kind: s.subject_kind, country: s.country })}`;
}

export type StrategicStep = "identidad" | "entorno" | "foda" | "portafolio" | "direccion" | "plan" | "informe";

/** Instrucciones de cada paso de la síntesis, por campo: cada ítem lista las claves del esquema que cubre. */
function stepItems(step: StrategicStep, s: StrategicRow): { title: string; items: [string[], string][] } {
  const kpiSource = s.subject_kind === "propia" ? '"Compa – índice de precio del análisis competitivo"' : '"estados financieros publicados"';
  switch (step) {
    case "identidad": return { title: "identidad y modelo de negocio", items: [
      [["mision", "vision"], "mision y vision: si la organización publica una, evalúala y propone una versión mejorada; si no, redáctalas. La misión responde qué hace, para quién y cómo; la visión, a dónde quiere llegar y en qué plazo. Justifica cada una."],
      [["valores"], "valores: 4-6 valores coherentes con la misión."],
      [["canvas"], "canvas: Modelo de negocio Canvas, 2-4 puntos por cada uno de los 9 bloques."],
      [["cadena_valor"], "cadena_valor: cadena de valor de Porter con las 5 actividades primarias (logística de entrada, operaciones, logística de salida, marketing y ventas, servicio posventa) y las 4 de apoyo (infraestructura, recursos humanos, desarrollo tecnológico, abastecimiento); evalúa cada una como ventaja, paridad o a mejorar. En procesos lista POR LO MENOS 5 procesos principales de cada actividad (verbo + objeto, concretos para esta organización; p. ej. en logística de entrada: «Recepción y verificación de mercadería de proveedores»), y cita el modelo en el análisis (Porter, 1985)."],
    ] };
    case "entorno": return { title: "entorno y competencia", items: [
      [["pestel"], "pestel: 2-3 factores por cada dimensión (político, económico, social, tecnológico, ecológico, legal) con impacto y si es oportunidad o amenaza. Usa los datos de la investigación."],
      [["porter"], "porter: las cinco fuerzas con intensidad, puntaje 1-5 y 2-4 factores cada una, más una conclusión sobre el atractivo del sector."],
      [["mpc"], `mpc: Matriz de Perfil Competitivo con 5-7 factores clave de éxito (pesos que suman 1) y calificación 1-4 para "${s.subject_name}" y 2-3 competidores reales de la investigación (usa exactamente los mismos nombres de empresa en todos los factores), más una conclusión.`],
    ] };
    case "foda": return { title: "FODA y matrices de evaluación", items: [
      [["foda"], "foda: 4-6 puntos por cuadrante. Fortalezas y debilidades son internas (usa la cadena de valor, el Canvas y los datos internos si están disponibles); oportunidades y amenazas salen del PESTEL, de Porter, de la MPC y de la investigación."],
      [["matriz_efi", "matriz_efe"], "matriz_efi (fortalezas y debilidades del FODA) y matriz_efe (oportunidades y amenazas): pesos de 0 a 1 que suman 1 en cada matriz; calificación 1-4 (EFI: 1 debilidad mayor, 2 debilidad menor, 3 fortaleza menor, 4 fortaleza mayor; EFE: 1 respuesta pobre … 4 respuesta superior)."],
    ] };
    case "portafolio": return { title: "portafolio y crecimiento", items: [
      [["bcg"], `bcg: matriz BCG con 3-6 líneas de producto o unidades de negocio (${s.subject_kind === "propia" ? "agrupa el catálogo de Compa por categoría" : "según la oferta encontrada"}). Estima el crecimiento anual del mercado (%) y la participación relativa frente al líder con los datos disponibles (investigación, documento, posición de precios); son estimaciones, explica en base_estimacion de qué datos salen. Alto crecimiento ≥ 10 %; participación alta ≥ 1. Da una estrategia por línea (invertir, mantener, cosechar, desinvertir).`],
      [["ansoff"], "ansoff: opciones de crecimiento en los 4 cuadrantes de la matriz de Ansoff (1-3 cada uno), cuál se recomienda y por qué. Si el análisis previo incluye la matriz IE o la BCG, debe ser coherente con ellas; si recomiendas algo distinto a lo que sugiere la IE, justifícalo explícitamente."],
    ] };
    case "direccion": return { title: "dirección estratégica a partir de la matriz IE", items: [
      [["direccion"], `direccion: redacta, con tono formal y empresarial, dirigido a los dueños y la alta dirección de "${s.subject_name}", la lectura del cuadrante de la matriz IE (está en el análisis previo; no lo cambies) y lo que implica:
   - interpretacion: 2 párrafos. Qué significan los totales EFI y EFE y el cuadrante obtenido (I, II o IV: crecer y construir; III, V o VII: conservar y mantener; VI, VIII o IX: cosechar o desinvertir), apoyándote en las fortalezas, debilidades, oportunidades y amenazas de mayor peso. Cita el modelo (David y David, 2017) y las fuentes de la investigación que respalden los datos.
   - estrategia_general: estrategia corporativa coherente con el cuadrante (Crecimiento para crecer y construir, Estabilidad para conservar y mantener, Reducción para cosechar o desinvertir) (Wheelen et al., 2018), con su fundamento.
   - estrategia_competitiva: estrategia genérica de Porter (Porter, 1980) con la que competirá el negocio, coherente con la cadena de valor, la MPC y Porter si están disponibles, con su fundamento.
   - estrategias_negocio: 4-6 estrategias de negocio que se desprenden de la estrategia general; categoría según David (intensivas: penetración de mercado, desarrollo de mercado, desarrollo de producto; integración: hacia adelante, hacia atrás, horizontal; diversificación: relacionada, no relacionada; defensivas: atrincheramiento, desinversión, liquidación). En crecer y construir prioriza intensivas e integración; en conservar y mantener, penetración de mercado y desarrollo de producto; en cosechar o desinvertir, defensivas. Cada una con descripción, 3-4 acciones concretas y horizonte de tiempo. Si están la BCG o Ansoff, mantén la coherencia con ellas.
   - recomendacion: un párrafo final de recomendación a los dueños, en primera persona del plural de la consultora ("recomendamos…").`],
    ] };
    case "informe": return { title: "informe de gestión e informe ejecutivo", items: [
      [["informe_gestion"], `informe_gestion: informe de gestión del plan estratégico empresarial de "${s.subject_name}", formal, en prosa empresarial y con citas APA 7 en el texto, organizado en dos fases: análisis de la situación actual y diseño de la solución.
   - presentacion: objetivo del informe, alcance y metodología (herramientas usadas y fuentes).
   - situacion_actual: 2-3 párrafos que integran identidad, modelo de negocio, cadena de valor, entorno PESTEL, Porter y posición competitiva.
   - diagnostico: 1-2 párrafos con el FODA, los totales EFI/EFE, el cuadrante IE y el portafolio BCG.
   - propuesta: 2 párrafos con la estrategia general, la competitiva, las estrategias de negocio, la opción de Ansoff y los objetivos estratégicos.
   - plan_implementacion: 5-8 acciones con responsable (cargo), plazo, recursos y el indicador (KPI) con que se medirá.
   - seguimiento: cómo se controlará el plan (tablero BSC, frecuencia de revisión, responsables).
   - conclusiones: 4-6; recomendaciones: 4-6.`],
      [["informe_ejecutivo"], "informe_ejecutivo: síntesis de una página para la gerencia, directa y formal: situacion (2-3 oraciones), hallazgos (4-5 hallazgos clave con cifras), decision (la estrategia general y competitiva recomendada, en 2 oraciones), prioridades (3-5), resultados_esperados (metas cuantificadas con plazo) y proximos_pasos (3-5, con plazo)."],
    ] };
    case "plan": return { title: "plan estratégico", items: [
      [["objetivos_estrategicos"], "objetivos_estrategicos: 4-6 objetivos SMART, cada uno con su perspectiva del Balanced Scorecard y plazo."],
      [["estrategias"], `estrategias: matriz FODA cruzada con 2 estrategias por cuadrante (FO, FA, DO, DA), 8 en total, que crucen puntos concretos del FODA y sean coherentes con la matriz IE, la dirección estratégica (estrategia general y de negocio), la BCG y la opción de Ansoff recomendada cuando estén en el análisis previo. CADA estrategia tiene un KPI con:
   - nombre y formula de cálculo,
   - tipo_indicador (Eficacia = grado de logro de la meta; Eficiencia = uso de recursos; Efectividad = impacto logrado; Calidad; Productividad; Financiero),
   - perspectiva del Balanced Scorecard,
   - fuente_informacion: de dónde se sacará el dato concreto (p. ej. "ERP/sistema de ventas – reporte mensual de ventas por canal", "Google Analytics del sitio web", "encuesta NPS post-compra", "INEI – Encuesta Nacional de Hogares", ${kpiSource}) y si es Interna o Externa,
   - frecuencia de medición, linea_base (dato actual si se conoce o "por levantar") y meta cuantificada con plazo.`],
      [["resumen_ejecutivo"], "resumen_ejecutivo: 4-6 oraciones con el diagnóstico (EFI, EFE, cuadrante IE y posición competitiva, según lo disponible) y la dirección estratégica recomendada."],
    ] };
  }
}

/** Instrucciones del paso, solo para los campos pedidos (el usuario elige qué herramientas correr). */
function stepTask(step: StrategicStep, s: StrategicRow, fields: string[]): string {
  const { title, items } = stepItems(step, s);
  const chosen = items.filter(([keys]) => keys.some((k) => fields.includes(k)));
  return `ENTREGA (${title})\n${chosen.map(([, text], i) => `${i + 1}. ${text}`).join("\n")}`;
}

/** Fuentes que el modelo puede citar en el texto (APA 7), con la cita exacta a usar para que la web la enlace. */
function citationBlock(research: Research): string {
  const refs = referenceList(research, THEORY.map((t) => t.id).filter((id) => !TD_THEORY_IDS.includes(id)));
  return `FUENTES CITABLES (APA 7)
Cuando un texto use un dato de la investigación o un modelo teórico, cítalo en el texto en formato APA 7 escribiendo entre paréntesis exactamente la cita que aparece entre corchetes, p. ej. "(Porter, 1985)" o "(${refs.find((r) => r.tipo === "web")?.cita ?? "Banco Central de Reserva del Perú, 2025"})". Varias citas juntas se separan con punto y coma. No cites fuentes que no estén en esta lista.
${refs.map((r) => `- [${r.cita}] ${refText(r)}`).join("\n")}`;
}

export function strategicStepPrompt(step: StrategicStep, s: StrategicRow, research: Research, ctx: InternalContext | undefined, prior: Record<string, unknown>, fields: string[]): string {
  // El documento completo solo hace falta donde se evalúa lo interno; en el resto basta la investigación (que ya lo resume).
  const doc = s.doc_text && (step === "identidad" || step === "foda" || step === "plan" || step === "informe")
    ? `\nDOCUMENTO DEL USUARIO ("${s.doc_name}"):\n"""\n${s.doc_text}\n"""\n` : "";
  const known = Object.fromEntries(Object.entries(prior).filter(([, v]) => v != null));
  const before = Object.keys(known).length ? `\nANÁLISIS YA REALIZADO EN PASOS ANTERIORES (JSON; mantén la coherencia con él):\n${JSON.stringify(known)}\n` : "";
  return `Eres un consultor senior de planeamiento estratégico. Estás elaborando en ESPAÑOL, por partes, el diagnóstico y plan estratégico de "${s.subject_name}"${s.subject_kind === "propia" ? " (es la empresa del usuario)" : " (organización externa analizada por el usuario)"}. En este paso entrega SOLO lo que se pide abajo.

${subjectBlock(s)}
${internalBlock(ctx)}
INVESTIGACIÓN WEB (JSON):
${JSON.stringify(research)}
${doc}${before}
${citationBlock(research)}

${stepTask(step, s, fields)}

Basa todo en la información entregada; no inventes cifras que no estén en ella (las metas y estimaciones sí son propuestas, indícalo). Responde únicamente con el JSON del esquema.

CONTEXT_JSON: ${JSON.stringify({ name: s.subject_name, kind: s.subject_kind, country: s.country, step })}`;
}
