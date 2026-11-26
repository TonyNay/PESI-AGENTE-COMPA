// Datos simulados de los agentes de la fase III (AGENT_PROVIDER=mock): sirven para exponer sin conexión
// y para probar el flujo. Todo va rotulado como simulado y nunca imita referencias o precios reales.
type Ctx = { name?: string; step?: string; ids?: (string | [string, string])[]; currency?: string; year?: number; refs?: string[]; marco?: string };

const idList = (c: Ctx) => (c.ids ?? []).map((x) => (Array.isArray(x) ? x : [x, x])) as [string, string][];
const CATS = ["Comercio electrónico", "CRM y clientes", "BI y analítica", "ERP y gestión", "Automatización de procesos", "Ciberseguridad", "Nube e infraestructura", "Inteligencia artificial"];
const STD = ["Tienda en línea integrada con pasarela de pagos", "CRM en la nube con historial de clientes", "Tablero de inteligencia de negocios", "ERP modular de inventarios y compras", "Automatización de reportes y flujos (RPA ligero)", "Gestión de identidades y copias de seguridad", "Migración de servidores a la nube", "Asistente de atención con IA generativa"];

export function mockTd(label: string, c: Ctx): Record<string, unknown> {
  const ids = idList(c);
  const name = c.name || "la organización";
  switch (label) {
    case "strategic-td-std": return { std: {
      alineacion: { vision: "(visión del plan)", mision: "(misión del plan)", lectura: `Cada estrategia de ${name} se despliega con una S/TD que la hace ejecutable y medible (datos simulados).` },
      capacidades_actuales: [{ sistema: "Sitio web institucional", uso: "Información de productos", evidencia: "Investigación web (simulado)", origen: "fuente" }, { sistema: "Hojas de cálculo", uso: "Control de ventas e inventario", evidencia: "Notas del usuario (simulado)", origen: "usuario" }],
      filas: ids.map(([id, t], i) => ({
        id, estrategia: t, objetivo: i % 2 ? "Elevar el NPS a 50 puntos" : "Aumentar las ventas online en 20% en 12 meses",
        vinculo: "Concreta la misión de servir con cercanía y acerca la visión al 2030.", std: STD[i % STD.length], categoria: CATS[i % CATS.length],
        situacion: i % 3 === 0 ? "mejorar" : i % 3 === 1 ? "nueva" : "existente", capacidad_actual: i % 3 === 2 ? "Sitio web actual" : "Sin evidencia",
        finalidad: "Ejecutar la estrategia con datos y procesos digitales.", justificacion: "Las capacidades actuales no cubren el volumen ni la trazabilidad requeridos (Ward y Peppard, 2016).",
        aporte: "Reducción de tiempos y mayor conversión (simulado).", origen: "ia",
      })),
      conclusion: "La mayoría de estrategias se apoya en ampliar capacidades existentes; las nuevas se concentran en analítica y clientes (simulado).",
    } };
    case "strategic-td-pareto": {
      const keys = ["impacto", "urgencia", "contribucion", "recursos", "viabilidad"];
      const names = ["Impacto esperado", "Urgencia", "Contribución a los objetivos", "Recursos disponibles", "Viabilidad de implementación"];
      const w = [0.3, 0.15, 0.25, 0.1, 0.2];
      return { pareto: {
        metodo: "Puntajes 1-5 por juicio experto sobre los datos del análisis (simulado) (Juran y De Feo, 2010).",
        criterios: keys.map((k, i) => ({ key: k, nombre: names[i], descripcion: "1 = muy bajo · 5 = muy alto", peso: w[i] })),
        evaluaciones: ids.map(([id], i) => ({ id, datos_base: "FODA y objetivos (simulado)", origen: "ia",
          puntajes: keys.map((k, j) => ({ criterio: k, valor: Math.max(1, Math.min(5, 5 - ((i * 2 + j) % 5) + (i < 2 ? 1 : 0))), justificacion: "Sustento simulado" })) })),
        limitaciones: ["Puntajes ordinales de juicio experto", "Sin datos de costo real al momento de priorizar", "Datos simulados"],
      } };
    }
    case "strategic-td-presupuesto": {
      const cur = c.currency || "PEN";
      return { presupuesto: {
        moneda: cur, horizonte_meses: 12,
        partidas: ids.flatMap(([id], i) => [
          { id: `${id}-1`, std_id: id, concepto: "Licencia SaaS (simulado)", categoria: "Licencias", tipo: "recurrente", periodicidad: "mensual", cantidad: 3 + i, unidad: "usuario", costo_unitario: 45 + i * 10, origen: "estimacion", fuente_url: "", nota: "Valor referencial simulado" },
          { id: `${id}-2`, std_id: id, concepto: "Implementación y configuración", categoria: "Implementación", tipo: "inicial", periodicidad: "unica", cantidad: 1, unidad: "servicio", costo_unitario: 2500 + i * 700, origen: "estimacion", fuente_url: "", nota: "Estimación simulada" },
          { id: `${id}-3`, std_id: id, concepto: "Capacitación del personal", categoria: "Capacitación", tipo: "inicial", periodicidad: "unica", cantidad: 8, unidad: "horas", costo_unitario: 60, origen: "estimacion", fuente_url: "", nota: "Simulado" },
        ]),
        supuestos: ["Precios sin IGV", "Tipo de cambio referencial", "Datos simulados"],
        limitaciones: ["No son cotizaciones: deben solicitarse a proveedores"],
      } };
    }
    case "strategic-td-kpis": return { kpis: {
      indicadores: ids.map(([id, t], i) => ({
        id: `K${i + 1}`, estrategia_id: id, estrategia: t, objetivo: "Aumentar las ventas online en 20% en 12 meses", nombre: `Indicador de ${t.toLowerCase().slice(0, 40)}`,
        tipo: ["Eficacia", "Eficiencia", "Efectividad", "Productividad"][i % 4], justificacion_tipo: "Mide el grado de logro de la meta (simulado).",
        def_conceptual: "Proporción del resultado logrado frente al esperado.", def_operacional: "Se cuenta mensualmente desde el registro del sistema.",
        formula: "(resultado logrado / resultado programado) × 100", unidad: "%", linea_base: i % 2 ? "Pendiente de determinación" : "62 %", linea_base_estado: i % 2 ? "pendiente" : "disponible",
        meta: i % 2 ? "80 % en 12 meses (provisional)" : "75 % en 12 meses", fuente: "Sistema de ventas – reporte mensual", frecuencia: "Mensual", responsable: "Jefe comercial",
        coherencia: "El reporte del sistema contiene numerador y denominador.", origen: i % 2 ? "ia" : "usuario",
      })),
      datos_solicitados: ["Ventas mensuales por canal de los últimos 12 meses (simulado)"],
    } };
    case "strategic-td-literatura": {
      const y = c.year || new Date().getFullYear();
      return { literatura: {
        consultas: ["(simulado) digital transformation strategic planning", "(simulado) information systems SME"],
        referencias: [1, 2, 3, 4].flatMap((area) => [1, 2, 3].map((k) => ({
          id: `R${(area - 1) * 3 + k}`, area, autores: `Autor${area}${k}, A., y Coautor, B.`, anio: y - ((k + area) % 4), titulo: `Referencia simulada ${area}.${k}: no citar`,
          revista: "Revista simulada", volumen: "", numero: "", paginas: "", doi: "", url: "", bases: [], estado: "sugerida", aporte: "Ejemplo de dimensión (simulado)",
        }))),
        nota: "Modo de demostración: estas referencias NO existen; con un proveedor real el agente busca artículos verificables.",
      } };
    }
    case "strategic-td-operacionalizacion": {
      const r = c.refs ?? [];
      return { operacionalizacion: {
        problema: "¿En qué medida el despliegue de S/TD mejora la gestión estratégica? (simulado)",
        variables: [
          { nombre: "Despliegue de sistemas y tecnologías digitales", tipo: "independiente", def_conceptual: "Definición simulada.", refs_conceptual: r.slice(0, 2), def_operacional: "Se mide con una encuesta de 15 ítems (simulado).",
            dimensiones: [{ nombre: "Infraestructura", indicadores: ["Disponibilidad"], refs: r.slice(9, 10) }, { nombre: "Sistemas de información", indicadores: ["Integración"], refs: r.slice(3, 4) }, { nombre: "Analítica", indicadores: ["Uso de tableros"], refs: r.slice(6, 7) }] },
          { nombre: "Gestión estratégica", tipo: "dependiente", def_conceptual: "Definición simulada.", refs_conceptual: r.slice(0, 1), def_operacional: "Índice de cumplimiento de objetivos (simulado).",
            dimensiones: [{ nombre: "Planificación", indicadores: ["Objetivos con KPI"], refs: r.slice(1, 2) }, { nombre: "Control", indicadores: ["Revisiones al año"], refs: r.slice(2, 3) }] },
        ],
      } };
    }
    case "strategic-td-brechas": {
      const ejes = ["Gobierno digital", "Economía digital", "Talento digital", "Confianza digital", "Conectividad", "Datos e IA"];
      return { brechas: {
        documento_institucional: "Plan institucional (simulado)", documento_referencia: c.marco || "Marco de referencia (simulado)",
        filas: ejes.flatMap((eje, i) => [0, 1].map((k) => ({
          id: `L${i * 2 + k + 1}`, eje, lineamiento: `Lineamiento simulado ${i * 2 + k + 1} de ${eje.toLowerCase()}`, objetivo_institucional: k ? "No se identifica" : "Objetivo institucional relacionado (simulado)",
          situacion_actual: "Situación descrita en el documento (simulado)", evidencia: k ? "sin evidencia" : "\"…texto citado…\" (simulado)", evidencia_fuente: k ? "" : "Plan institucional, p. 12 (simulado)",
          nivel: (i + k * 2) % 4, brecha: "Brecha simulada", necesidad: "Necesidad simulada", problema: "Problema simulado", origen: k ? "ia" : "fuente",
        }))),
        problemas: [
          { id: "P1", tipo: "general", enunciado: `¿Cuál es el nivel de alineamiento entre el plan de ${name} y el marco de transformación digital? (simulado)`, lineamientos: ["L1", "L3"], evidencia: "Ver matriz" },
          { id: "P2", tipo: "especifico", enunciado: "¿Cómo influye la gestión de datos en los servicios digitales? (simulado)", lineamientos: ["L11"], evidencia: "Ver matriz" },
        ],
        limitaciones: ["Datos simulados"],
      } };
    }
    case "strategic-td-estrategias": return { estrategias_td: {
      propuestas: ids.map(([id], i) => ({
        id: `T${i + 1}`, lineamiento_id: id, lineamiento: `Lineamiento ${id}`, aplica: i % 4 !== 3, motivo_no_aplica: i % 4 === 3 ? "Se cubre con otra propuesta (simulado)" : "",
        necesidad: "Necesidad simulada", brecha: "Brecha simulada", estrategia: i % 4 === 3 ? "" : `Estrategia digital simulada ${i + 1}`, std: i % 4 === 3 ? "" : STD[i % STD.length],
        justificacion: "Justificación simulada", beneficio: "Beneficio simulado", indicador: "% de trámites digitales = digitales / totales × 100",
        exigencia: ["baja", "media", "alta"][i % 3], horizonte: "12 meses", origen: "ia",
      })),
      conclusion: "Propuestas simuladas ordenadas por brecha (Westerman et al., 2014).",
    } };
    case "strategic-td-informe": return {
      informe_gestion_td: {
        presentacion: `Informe de gestión integrado de ${name} (simulado).`, diagnostico: "Diagnóstico consolidado (simulado).", objetivos_estrategias: "Objetivos y estrategias (simulado).",
        tecnologias: "S/TD por estrategia (simulado).", priorizacion: "Resultado de Pareto (simulado).", indicadores: "KPI con líneas base pendientes (simulado).", presupuesto: "Inversión según los totales calculados (simulado).",
        responsables: [{ rol: "Gerencia general", responsabilidad: "Patrocinio y decisión", estrategias: ["E1", "E2"] }, { rol: "Jefe de TI", responsabilidad: "Implementación de S/TD", estrategias: ["E3"] }],
        seguimiento: [{ mecanismo: "Tablero de KPI", frecuencia: "Mensual", responsable: "Jefe de planeamiento", instrumento: "Tablero BSC" }],
        conclusiones: ["Conclusión simulada"], recomendaciones: ["Recomendación simulada"],
      },
      informe_ejecutivo_td: {
        situacion: "Situación simulada.", hallazgos: ["Hallazgo simulado"], decisiones: ["Decisión simulada"], tecnologias_prioritarias: ["S/TD simulada"],
        inversion: "Inversión según los totales calculados (simulado).", resultados_esperados: ["Resultado simulado"], proximos_pasos: ["Paso simulado"],
      },
    };
  }
  return {};
}
