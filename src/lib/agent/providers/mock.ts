import type { LLMProvider, RunStructuredOpts, RunStructuredResult } from "../types";
import { mockTd } from "./mock-td";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function hash(s: string) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed: number) { let a = seed; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const STORES: { name: string; base: string; search: (q: string) => string }[] = [
  { name: "Falabella", base: "falabella.com.pe", search: (q) => `https://www.falabella.com.pe/falabella-pe/search?Ntt=${q}` },
  { name: "Ripley", base: "ripley.com.pe", search: (q) => `https://simple.ripley.com.pe/search/${q}` },
  { name: "Oechsle", base: "oechsle.pe", search: (q) => `https://www.oechsle.pe/${q}?_q=${q}&map=ft` },
  { name: "Plaza Vea", base: "plazavea.com.pe", search: (q) => `https://www.plazavea.com.pe/${q}?_q=${q}&map=ft` },
  { name: "Mercado Libre", base: "mercadolibre.com.pe", search: (q) => `https://listado.mercadolibre.com.pe/${q}` },
  { name: "Hiraoka", base: "hiraoka.com.pe", search: (q) => `https://hiraoka.com.pe/catalogsearch/result/?q=${q}` },
  { name: "Coolbox", base: "coolbox.pe", search: (q) => `https://www.coolbox.pe/${q}?_q=${q}&map=ft` },
  { name: "Promart", base: "promart.pe", search: (q) => `https://www.promart.pe/${q}?_q=${q}&map=ft` },
];

type Ctx = { name?: string; price?: number; currency?: string; type?: string; stats?: { count: number; min: number; max: number; avg: number; median: number; priceIndex: number; position: string; currency: string }; offers?: unknown[] };

function ctxOf(prompt: string): Ctx {
  const m = prompt.match(/CONTEXT_JSON:\s*(\{.*\})/);
  if (!m) return {};
  try { return JSON.parse(m[1]); } catch { return {}; }
}

/** Datos deterministas plausibles para demos offline y pruebas. */
export class MockProvider implements LLMProvider {
  readonly name = "mock";

  async runStructured<T = unknown>(opts: RunStructuredOpts): Promise<RunStructuredResult<T>> {
    const ctx = ctxOf(opts.prompt);
    if (opts.label?.startsWith("strategic-td-")) {
      opts.onProgress?.(`Agente simulado: ${opts.label.slice(13)}…`);
      await sleep(700);
      const data = mockTd(opts.label, ctx as Parameters<typeof mockTd>[1]);
      const keys = Object.keys((opts.schema.properties ?? {}) as Record<string, unknown>);
      return { data: Object.fromEntries(keys.map((k) => [k, data[k]])) as T, costUsd: 0, durationMs: 700 };
    }
    if (opts.label === "research" || opts.label?.startsWith("strategic")) {
      const research = opts.label === "research";
      opts.onProgress?.(research ? "Investigando la web (simulado)…" : `Redactando ${opts.label} (simulado)…`);
      await sleep(800);
      if (research) return { data: mockResearch(ctx.name || "Empresa") as T, costUsd: 0, durationMs: 800 };
      // Cada paso de la síntesis recibe solo las claves de su esquema.
      const plan = mockPlan(ctx.name || "Empresa") as Record<string, unknown>;
      const keys = Object.keys((opts.schema.properties ?? {}) as Record<string, unknown>);
      return { data: Object.fromEntries(keys.map((k) => [k, plan[k]])) as T, costUsd: 0, durationMs: 800 };
    }
    const isOffers = opts.label === "scraping";
    const steps = isOffers
      ? ["Buscando en la web (simulado)…", "Visitando páginas de tiendas…", "Extrayendo precios y características…"]
      : ["Evaluando posicionamiento de precio…", "Redactando recomendaciones…"];
    for (const s of steps) { opts.onProgress?.(s); await sleep(isOffers ? 900 : 700); }
    const data = isOffers ? this.offers(ctx) : this.strategy(ctx);
    return { data: data as T, costUsd: 0, durationMs: steps.length * 800 };
  }

  private offers(ctx: Ctx) {
    const name = ctx.name || "Producto";
    const own = ctx.price || 100;
    const r = rng(hash(name));
    const q = encodeURIComponent(name.toLowerCase().replace(/\s+/g, "-").slice(0, 60));
    const n = 6 + Math.floor(r() * 3);
    const offers = STORES.slice(0, n).map((s, i) => {
      const factor = 0.86 + r() * 0.3 + (i === 0 ? 0.04 : 0);
      const price = Math.round(own * factor) - 0.1;
      return {
        competitor: s.name,
        product_title: `${name} - ${s.name}`,
        price: Math.max(1, price),
        currency: ctx.currency || "PEN",
        url: s.search(q),
        availability: r() > 0.15 ? "En stock" : "Pocas unidades",
        features: ctx.type === "servicio" ? "Servicio con garantía y visita técnica incluida" : "Garantía del fabricante 12 meses; envío a domicilio",
        rating: Math.round((3.6 + r() * 1.3) * 10) / 10,
        match_score: Math.round((0.7 + r() * 0.3) * 100) / 100,
      };
    });
    // Casos que la normalización debe filtrar
    offers.push({ competitor: "Tienda Genérica", product_title: `Accesorio compatible con ${name}`, price: Math.round(own * 0.1), currency: ctx.currency || "PEN", url: "https://example.com/accesorio", availability: "En stock", features: "No comparable", rating: 4, match_score: 0.2 });
    return { offers };
  }

  private strategy(ctx: Ctx) {
    const s = ctx.stats;
    const own = ctx.price || 0;
    const cur = ctx.currency || "PEN";
    if (!s) {
      return { resumen_ejecutivo: "No se encontraron suficientes ofertas comparables.", fortalezas: [], debilidades: [], foda: { fortalezas: [], debilidades: [], oportunidades: [], amenazas: [] }, recomendaciones: [], precio_sugerido: own, justificacion_precio: "Sin datos de mercado." };
    }
    const pos = s.position;
    const suggested = pos === "expensive" ? Math.round(s.avg * 1.02) : pos === "cheaper" ? Math.round(Math.min(s.avg * 0.97, own * 1.05)) : Math.round(own);
    const posTxt = pos === "expensive" ? "por encima del mercado" : pos === "cheaper" ? "por debajo del mercado" : "alineado con el mercado";
    return {
      resumen_ejecutivo: `Con ${s.count} ofertas comparables, el precio de "${ctx.name}" (${cur} ${own}) está ${posTxt}: el índice de precio es ${s.priceIndex} frente al promedio de ${cur} ${s.avg} (rango ${s.min}–${s.max}). ${pos === "expensive" ? "Existe riesgo de perder ventas frente a competidores con precios más bajos." : pos === "cheaper" ? "Hay margen para capturar valor sin perder competitividad." : "La competencia es estrecha; la diferenciación vendrá del servicio y la disponibilidad."}`,
      fortalezas: [pos === "expensive" ? "Posible percepción premium si se acompaña de servicio" : "Precio competitivo frente a la mediana del mercado", "Producto con demanda establecida y múltiples puntos de comparación"],
      debilidades: [pos === "expensive" ? "Precio superior al promedio del mercado" : "Poco margen de diferenciación por precio", "Dependencia de promociones de grandes tiendas"],
      foda: {
        fortalezas: ["Conocimiento de la categoría", "Relación directa con el cliente"],
        debilidades: ["Menor escala que las grandes cadenas", "Menor poder de negociación con proveedores"],
        oportunidades: ["Bundles con servicios (instalación, garantía extendida)", "Campañas en fechas pico (Cyber Wow, Día de la Madre)"],
        amenazas: ["Guerra de precios en marketplaces", "Promociones agresivas de retailers"],
      },
      recomendaciones: [
        { titulo: pos === "expensive" ? "Ajustar el precio hacia el promedio" : "Mantener precio y reforzar valor", detalle: `Precio sugerido ${cur} ${suggested} (promedio ${s.avg}, mediana ${s.median}).`, prioridad: "alta" },
        { titulo: "Monitorear semanalmente", detalle: "Repetir el análisis cada semana para detectar cambios de precio de los 3 competidores más cercanos.", prioridad: "media" },
        { titulo: "Diferenciar con servicio", detalle: "Ofrecer envío rápido, garantía extendida o instalación para justificar el precio.", prioridad: "media" },
      ],
      precio_sugerido: suggested,
      justificacion_precio: `Se busca un índice cercano a 100 sin sacrificar margen; ${cur} ${suggested} queda ${suggested <= s.avg ? "en o bajo" : "ligeramente sobre"} el promedio del mercado.`,
    };
  }
}

function mockResearch(name: string) {
  return {
    perfil: {
      descripcion: `${name} es una organización que comercializa productos y servicios en el mercado local (datos simulados).`,
      sector: "Retail", propuesta_valor: "Precios competitivos y atención cercana", productos_servicios: ["Tecnología", "Hogar", "Servicios técnicos"],
      clientes_objetivo: "Hogares urbanos de nivel socioeconómico B y C", presencia_digital: "Sitio web y redes sociales (simulado)",
      mision_declarada: "", vision_declarada: "",
    },
    hallazgos_documento: [],
    competidores: [
      { nombre: "Falabella", descripcion: "Retail por departamentos", url: "https://www.falabella.com.pe" },
      { nombre: "Ripley", descripcion: "Retail por departamentos", url: "https://simple.ripley.com.pe" },
      { nombre: "Mercado Libre", descripcion: "Marketplace", url: "https://www.mercadolibre.com.pe" },
    ],
    entorno: [
      { dimension: "economico", dato: "Inflación anual cercana al rango meta del banco central (simulado)", fuente_url: "https://www.bcrp.gob.pe" },
      { dimension: "tecnologico", dato: "Crecimiento sostenido del comercio electrónico (simulado)", fuente_url: "https://www.capece.org.pe" },
      { dimension: "social", dato: "Mayor sensibilidad al precio en los hogares (simulado)", fuente_url: "https://www.inei.gob.pe" },
    ],
    tendencias_sector: ["Omnicanalidad", "Pagos digitales", "Entrega el mismo día"],
    fuentes: [
      { autor: "Banco Central de Reserva del Perú", anio: "2025", titulo: "Reporte de inflación (simulado)", sitio: "BCRP", url: "https://www.bcrp.gob.pe" },
      { autor: "Cámara Peruana de Comercio Electrónico", anio: "2025", titulo: "Reporte oficial de la industria ecommerce en Perú (simulado)", sitio: "CAPECE", url: "https://www.capece.org.pe" },
      { autor: "Instituto Nacional de Estadística e Informática", anio: "s.f.", titulo: "Encuesta Nacional de Hogares (simulado)", sitio: "INEI", url: "https://www.inei.gob.pe" },
    ],
  };
}

function mockPlan(name: string) {
  const f = (factor: string, peso: number, calificacion: number) => ({ factor, peso, calificacion });
  const force = (intensidad: string, puntaje: number, factores: string[]) => ({ intensidad, puntaje, factores });
  const kpi = (nombre: string, formula: string, tipo_indicador: string, perspectiva: string, fuente_informacion: string, tipo_fuente: string) =>
    ({ nombre, formula, tipo_indicador, perspectiva, fuente_informacion, tipo_fuente, frecuencia: "Mensual", linea_base: "Por levantar", meta: "+10% en 12 meses" });
  return {
    resumen_ejecutivo: `${name} opera en un sector de alta rivalidad (datos simulados). Se recomienda diferenciarse por servicio y canal digital, cuidando el precio frente a las grandes cadenas.`,
    mision: { texto: `Ofrecer a los hogares tecnología y servicios confiables a precios justos, con asesoría cercana.`, justificacion: "Indica qué, para quién y cómo." },
    vision: { texto: "Ser al 2030 el retailer especializado preferido por su servicio en el país.", justificacion: "Aspiracional, con plazo." },
    valores: ["Confianza", "Cercanía", "Innovación", "Responsabilidad"],
    objetivos_estrategicos: [
      { objetivo: "Aumentar las ventas online en 20% en 12 meses", perspectiva: "Financiera", plazo: "12 meses" },
      { objetivo: "Elevar el NPS a 50 puntos", perspectiva: "Clientes", plazo: "12 meses" },
    ],
    pestel: [
      { dimension: "politico", factor: "Estabilidad regulatoria del comercio", impacto: "media", efecto: "oportunidad" },
      { dimension: "economico", factor: "Consumo sensible al precio", impacto: "alta", efecto: "amenaza" },
      { dimension: "social", factor: "Preferencia por compra omnicanal", impacto: "alta", efecto: "oportunidad" },
      { dimension: "tecnologico", factor: "Crecimiento del e-commerce", impacto: "alta", efecto: "oportunidad" },
      { dimension: "ecologico", factor: "Gestión de residuos electrónicos", impacto: "baja", efecto: "amenaza" },
      { dimension: "legal", factor: "Normas de protección al consumidor", impacto: "media", efecto: "amenaza" },
    ],
    porter: {
      rivalidad: force("alta", 5, ["Grandes cadenas", "Marketplaces"]),
      nuevos_entrantes: force("media", 3, ["Bajas barreras online"]),
      sustitutos: force("media", 3, ["Compra internacional"]),
      poder_proveedores: force("alta", 4, ["Marcas concentradas"]),
      poder_clientes: force("alta", 4, ["Comparación de precios fácil"]),
      conclusion: "Sector poco atractivo por precio; el margen depende de la diferenciación.",
    },
    foda: {
      fortalezas: ["Atención personalizada", "Catálogo especializado"],
      debilidades: ["Menor escala", "Poca presencia digital"],
      oportunidades: ["E-commerce en crecimiento", "Servicios de instalación"],
      amenazas: ["Guerra de precios", "Marketplaces internacionales"],
    },
    matriz_efi: { fortalezas: [f("Atención personalizada", 0.3, 4), f("Catálogo especializado", 0.2, 3)], debilidades: [f("Menor escala", 0.3, 1), f("Poca presencia digital", 0.2, 2)] },
    matriz_efe: { oportunidades: [f("E-commerce en crecimiento", 0.3, 3), f("Servicios de instalación", 0.2, 3)], amenazas: [f("Guerra de precios", 0.3, 2), f("Marketplaces internacionales", 0.2, 2)] },
    estrategias: [
      { tipo: "FO", titulo: "Bundles producto + instalación", descripcion: "Vender paquetes con servicio técnico incluido.", prioridad: "alta", kpi: kpi("% de ventas con servicio", "(ventas con servicio / ventas totales) × 100", "Eficacia", "Financiera", "ERP – reporte mensual de ventas por tipo", "Interna") },
      { tipo: "FA", titulo: "Garantía de mejor servicio", descripcion: "Diferenciar por posventa frente a la guerra de precios.", prioridad: "media", kpi: kpi("NPS", "% promotores − % detractores", "Calidad", "Clientes", "Encuesta NPS post-compra", "Interna") },
      { tipo: "DO", titulo: "Tienda online propia", descripcion: "Lanzar e-commerce con retiro en tienda.", prioridad: "alta", kpi: kpi("Tasa de conversión web", "(pedidos / sesiones) × 100", "Efectividad", "Clientes", "Google Analytics del sitio web", "Interna") },
      { tipo: "DA", titulo: "Monitoreo de precios", descripcion: "Vigilar precios de la competencia cada semana.", prioridad: "media", kpi: kpi("Índice de precio", "(precio propio / promedio del mercado) × 100", "Eficiencia", "Procesos internos", "Compa – índice de precio del análisis competitivo", "Interna") },
    ],
    canvas: {
      socios_clave: ["Marcas y distribuidores mayoristas"], actividades_clave: ["Venta asesorada", "Instalación"],
      recursos_clave: ["Tienda física", "Técnicos certificados"], propuesta_valor: ["Asesoría honesta e instalación incluida"],
      relacion_clientes: ["Atención personalizada por WhatsApp"], canales: ["Tienda", "WhatsApp", "Web"],
      segmentos_clientes: ["Hogares urbanos NSE B y C"], estructura_costos: ["Inventario", "Planilla", "Alquiler"],
      fuentes_ingreso: ["Venta de productos", "Servicios de instalación"],
    },
    cadena_valor: [
      { actividad: "Logística de entrada", tipo: "primaria", analisis: "Compras a distribuidores locales.", evaluacion: "paridad", procesos: ["Planificación de compras según rotación", "Cotización y negociación con distribuidores", "Recepción y verificación de mercadería", "Registro de ingreso en inventario", "Almacenamiento por categoría"] },
      { actividad: "Operaciones", tipo: "primaria", analisis: "Tienda única con exhibición.", evaluacion: "paridad", procesos: ["Exhibición y rotulado de precios", "Control de inventario y mermas", "Preparación de pedidos", "Configuración de equipos para el cliente", "Cierre de caja diario"] },
      { actividad: "Logística de salida", tipo: "primaria", analisis: "Despacho en Lima.", evaluacion: "a mejorar", procesos: ["Programación de despachos", "Embalaje y rotulado", "Asignación de transportista", "Entrega a domicilio en Lima", "Confirmación de entrega al cliente"] },
      { actividad: "Marketing y ventas", tipo: "primaria", analisis: "Poca inversión digital.", evaluacion: "a mejorar", procesos: ["Definición de precios y promociones", "Gestión de redes sociales", "Atención de consultas por WhatsApp", "Venta asesorada en tienda", "Seguimiento de cotizaciones"] },
      { actividad: "Servicio posventa", tipo: "primaria", analisis: "Instalación propia.", evaluacion: "ventaja", procesos: ["Instalación a domicilio", "Gestión de garantías", "Soporte técnico telefónico", "Encuesta de satisfacción", "Gestión de reclamos y devoluciones"] },
      { actividad: "Infraestructura", tipo: "apoyo", analisis: "Gestión familiar.", evaluacion: "paridad", procesos: ["Planeamiento anual", "Contabilidad y tributación", "Gestión de tesorería", "Cumplimiento legal y licencias", "Control de gestión mensual"] },
      { actividad: "Recursos humanos", tipo: "apoyo", analisis: "Técnicos capacitados.", evaluacion: "ventaja", procesos: ["Reclutamiento y selección", "Inducción del personal", "Capacitación técnica", "Evaluación de desempeño", "Gestión de planillas"] },
      { actividad: "Desarrollo tecnológico", tipo: "apoyo", analisis: "Sin e-commerce.", evaluacion: "a mejorar", procesos: ["Mantenimiento del sistema de ventas", "Gestión del sitio web", "Digitalización de inventario", "Analítica de ventas", "Seguridad de la información"] },
      { actividad: "Abastecimiento", tipo: "apoyo", analisis: "Bajo poder de negociación.", evaluacion: "a mejorar", procesos: ["Evaluación y homologación de proveedores", "Negociación de condiciones de pago", "Emisión de órdenes de compra", "Seguimiento de pedidos a proveedores", "Gestión de contratos de suministro"] },
    ],
    mpc: {
      factores: [
        { factor: "Precio", peso: 0.3, calificaciones: [{ empresa: name, calificacion: 2 }, { empresa: "Falabella", calificacion: 4 }, { empresa: "Mercado Libre", calificacion: 4 }] },
        { factor: "Servicio posventa", peso: 0.3, calificaciones: [{ empresa: name, calificacion: 4 }, { empresa: "Falabella", calificacion: 2 }, { empresa: "Mercado Libre", calificacion: 1 }] },
        { factor: "Canal digital", peso: 0.4, calificaciones: [{ empresa: name, calificacion: 1 }, { empresa: "Falabella", calificacion: 4 }, { empresa: "Mercado Libre", calificacion: 4 }] },
      ],
      conclusion: "Los competidores dominan precio y canal digital; la ventaja propia es el servicio.",
    },
    bcg: {
      unidades: [
        { unidad: "Celulares", crecimiento_mercado: 15, participacion_relativa: 0.3, cuadrante: "interrogante", base_estimacion: "Crecimiento de la categoría (simulado)", estrategia: "Invertir selectivamente" },
        { unidad: "Servicios técnicos", crecimiento_mercado: 6, participacion_relativa: 1.2, cuadrante: "vaca", base_estimacion: "Servicio diferenciado (simulado)", estrategia: "Mantener y cosechar" },
        { unidad: "Hogar", crecimiento_mercado: 4, participacion_relativa: 0.2, cuadrante: "perro", base_estimacion: "Mercado maduro (simulado)", estrategia: "Reducir surtido" },
      ],
      conclusion: "Los servicios financian el crecimiento en celulares (simulado).",
    },
    ansoff: {
      penetracion: ["Programa de recompra"], desarrollo_mercado: ["Venta online a provincias"],
      desarrollo_producto: ["Garantía extendida propia"], diversificacion: ["Servicio de mantenimiento para empresas"],
      recomendada: "penetracion", justificacion: "Menor riesgo y aprovecha la base de clientes recurrentes.",
    },
    direccion: {
      interpretacion: `Con totales EFI de 2.50 y EFE de 2.50, ${name} se ubica en el cuadrante V de la matriz Interna-Externa, que corresponde a conservar y mantener (David y David, 2017). La posición interna es promedio: la atención personalizada compensa la menor escala, y la respuesta al entorno también es promedio frente al crecimiento del comercio electrónico (Cámara Peruana de Comercio Electrónico, 2025) y a la presión de precios (datos simulados).\n\nPara los dueños, esto significa que no conviene una expansión agresiva ni una retirada: la prioridad es consolidar el mercado actual y mejorar la oferta antes de crecer.`,
      estrategia_general: { tipo: "Estabilidad", fundamento: "El cuadrante V recomienda conservar y mantener; la estabilidad permite reforzar la posición sin comprometer recursos escasos (Wheelen et al., 2018)." },
      estrategia_competitiva: { tipo: "Enfoque en diferenciación", fundamento: "La ventaja está en el servicio posventa y la asesoría, no en el precio; conviene enfocarse en hogares que valoran el servicio (Porter, 1980)." },
      estrategias_negocio: [
        { categoria: "Intensiva", nombre: "Penetración de mercado", descripcion: "Aumentar la participación con los clientes actuales mediante recompra y referidos.", acciones: ["Programa de puntos", "Campañas a la base de clientes", "Bundles con instalación"], horizonte: "0-12 meses" },
        { categoria: "Intensiva", nombre: "Desarrollo de producto", descripcion: "Ampliar la oferta de servicios propios.", acciones: ["Garantía extendida propia", "Plan de mantenimiento anual", "Configuración a domicilio"], horizonte: "6-18 meses" },
        { categoria: "Defensiva", nombre: "Atrincheramiento", descripcion: "Reducir surtido de baja rotación para liberar capital.", acciones: ["Depurar la línea Hogar", "Renegociar condiciones de pago", "Reducir inventario inmovilizado"], horizonte: "0-6 meses" },
      ],
      recomendacion: "Recomendamos a los dueños adoptar una estrategia de estabilidad con enfoque en diferenciación por servicio, priorizar la penetración de mercado y revisar el surtido antes de cualquier expansión (datos simulados).",
    },
    informe_gestion: {
      presentacion: `El presente informe expone el plan estratégico de ${name}. Se aplicaron las herramientas de análisis de la situación actual (Canvas, cadena de valor, PESTEL, Porter, MPC, FODA, EFI/EFE, IE y BCG) y de diseño de la solución (dirección estratégica, Ansoff y FODA cruzado con KPI) (David y David, 2017). Datos simulados.`,
      situacion_actual: `${name} es un retailer especializado con ventaja en servicio posventa y debilidades en canal digital y escala. El sector presenta alta rivalidad (Porter, 2008) y un comercio electrónico en crecimiento (Cámara Peruana de Comercio Electrónico, 2025).`,
      diagnostico: "La EFI y la EFE suman 2.50, lo que ubica a la empresa en el cuadrante V (conservar y mantener). El portafolio depende de los servicios técnicos como vaca lechera (Henderson, 1970).",
      propuesta: "Se propone una estrategia general de estabilidad con enfoque en diferenciación, apoyada en penetración de mercado y desarrollo de producto (Ansoff, 1957), con objetivos medidos en las cuatro perspectivas del BSC (Kaplan y Norton, 1996).",
      plan_implementacion: [
        { accion: "Lanzar bundles producto + instalación", responsable: "Jefe comercial", plazo: "3 meses", recursos: "S/ 5 000 en material y capacitación", indicador: "% de ventas con servicio" },
        { accion: "Implementar tienda online con retiro en tienda", responsable: "Gerente general", plazo: "6 meses", recursos: "Plataforma e-commerce y 1 analista", indicador: "Tasa de conversión web" },
        { accion: "Medir NPS post-compra", responsable: "Jefe de posventa", plazo: "1 mes", recursos: "Formulario en línea", indicador: "NPS" },
        { accion: "Monitoreo semanal de precios", responsable: "Analista comercial", plazo: "Continuo", recursos: "Compa", indicador: "Índice de precio" },
        { accion: "Depurar surtido de baja rotación", responsable: "Jefe de compras", plazo: "4 meses", recursos: "Reporte de rotación", indicador: "Días de inventario" },
      ],
      seguimiento: "Tablero BSC revisado mensualmente por la gerencia; cada KPI tiene responsable, fuente y meta.",
      conclusiones: ["La posición es promedio en lo interno y lo externo (cuadrante V).", "La ventaja competitiva está en el servicio.", "El canal digital es la principal brecha."],
      recomendaciones: ["Adoptar la estrategia de estabilidad con diferenciación.", "Priorizar el canal digital.", "Medir el plan con el tablero de KPI."],
    },
    informe_ejecutivo: {
      situacion: `${name} compite en un sector de alta rivalidad con una ventaja clara en servicio y una brecha en canal digital (datos simulados).`,
      hallazgos: ["EFI 2.50 y EFE 2.50: cuadrante V de la matriz IE.", "Servicio posventa evaluado como ventaja.", "Canal digital por debajo de los competidores en la MPC.", "Servicios técnicos son la vaca lechera del portafolio."],
      decision: "Estabilidad como estrategia general y enfoque en diferenciación por servicio como estrategia competitiva.",
      prioridades: ["Bundles con instalación", "Tienda online", "Medición de NPS"],
      resultados_esperados: "Ventas online +20 % y NPS de 50 en 12 meses.",
      proximos_pasos: ["Aprobar el plan (semana 1)", "Designar responsables (semana 2)", "Lanzar el tablero BSC (mes 1)"],
    },
  };
}
