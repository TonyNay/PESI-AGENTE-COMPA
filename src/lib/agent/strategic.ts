import fs from "node:fs";
import path from "node:path";
import { all, get, run } from "../db";
import { latestCompleted } from "../queries";
import type { BcgQuadrant, Company, IeResult, MatrixFactor, Product, Research, StrategicPlan, StrategicResult, StrategicRow } from "../types";
import { researchPrompt, strategicStepPrompt, type InternalContext, type StrategicStep } from "./prompts";
import { getProvider } from "./providers";
import { DIRECTION_SCHEMA, ENVIRONMENT_SCHEMA, IDENTITY_SCHEMA, PLAN_SCHEMA, PORTFOLIO_SCHEMA, REPORT_SCHEMA, RESEARCH_SCHEMA, SWOT_SCHEMA, pickSchema } from "./schemas";
import { moduleDef, moduleDone, parseModules, type ModuleKey } from "../strategy-modules";
import type { Attachment, JsonSchema, RunStructuredOpts } from "./types";
import { runTdAgents } from "./td";

export const UPLOAD_DIR = path.join(path.dirname(process.env.COMPA_DB_PATH || path.join(process.cwd(), "data", "compa.db")), "uploads");

export function logStrategic(id: number, step: string, message: string, level = "info") {
  run("INSERT INTO strategic_logs (strategic_id, step, level, message) VALUES (?,?,?,?)", id, step, level, message);
}

export type StrategicInput = {
  kind: "propia" | "externa"; name: string; websiteUrl?: string; industry?: string; country?: string;
  notes?: string; docName?: string; docText?: string;
};

export function createStrategic(companyId: number, input: StrategicInput, modules: ModuleKey[], provider?: string): number {
  const name = provider || process.env.AGENT_PROVIDER || "claude-cli";
  return run(
    `INSERT INTO strategic_analyses (company_id, subject_kind, subject_name, website_url, industry, country, notes, doc_name, doc_text, status, provider, modules)
     VALUES (?,?,?,?,?,?,?,?,?, 'queued', ?, ?)`,
    companyId, input.kind, input.name, input.websiteUrl || null, input.industry || null, input.country || null,
    input.notes || null, input.docName || null, input.docText || null, name, JSON.stringify(modules)
  ).lastInsertRowid;
}

/** Guarda un PDF subido para que el agente lo lea en el paso de investigación. */
export function attachPdf(id: number, data: Buffer) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const file = path.join(UPLOAD_DIR, `strategic-${id}.pdf`);
  fs.writeFileSync(file, data);
  run("UPDATE strategic_analyses SET doc_path = ? WHERE id = ?", file, id);
}

/** Lo que Compa ya sabe de la propia empresa: catálogo y resultados de la herramienta de precios. */
function internalContext(company: Company): InternalContext {
  const products = all<Product>("SELECT * FROM products WHERE company_id = ? ORDER BY name", company.id);
  const latest = latestCompleted(company.id);
  const priceLines = latest.filter((l) => l.result.stats).map((l) => {
    const s = l.result.stats!;
    return `- ${l.product_name}: precio propio ${s.currency} ${s.ownPrice}; mercado mín ${s.min} / prom ${s.avg} / máx ${s.max} (${s.count} ofertas); índice de precio ${s.priceIndex}; posición ${s.position}; precio sugerido ${l.result.strategy?.precio_sugerido ?? "n/d"}`;
  });
  const competitors = latest.length
    ? all<{ competitor: string }>(
        `SELECT competitor, COUNT(*) n FROM competitor_offers WHERE analysis_id IN (${latest.map(() => "?").join(",")})
         GROUP BY LOWER(competitor) ORDER BY n DESC LIMIT 12`, ...latest.map((l) => l.analysis_id)).map((r) => r.competitor)
    : [];
  return { company, products, priceLines, competitors };
}

/** Normaliza los pesos a 1, acota calificaciones a 1-4 y devuelve el total ponderado. */
function weigh(groups: MatrixFactor[][]): number {
  const items = groups.flat();
  for (const f of items) {
    f.peso = Math.max(0, Number(f.peso) || 0);
    f.calificacion = Math.min(4, Math.max(1, Math.round(Number(f.calificacion) || 1)));
  }
  const sum = items.reduce((s, f) => s + f.peso, 0) || 1;
  for (const f of items) f.peso = Math.round((f.peso / sum) * 1000) / 1000;
  return Math.round(items.reduce((s, f) => s + f.peso * f.calificacion, 0) * 100) / 100;
}

/** Matriz IE: columnas por EFI (fuerte ≥3, promedio 2–2.99, débil <2) y filas por EFE (alto ≥3, medio 2–2.99, bajo <2). */
export function ieCell(efi: number, efe: number): IeResult {
  const col = efi >= 3 ? 0 : efi >= 2 ? 1 : 2;
  const row = efe >= 3 ? 0 : efe >= 2 ? 1 : 2;
  const cuadrante = row * 3 + col + 1;
  const diag = row + col;
  return { cuadrante, estrategia: diag <= 1 ? "Crecer y construir" : diag === 2 ? "Conservar y mantener" : "Cosechar o desinvertir" };
}

/** Normaliza pesos de la MPC y calcula el total ponderado por empresa (mismo orden en que aparecen). */
function mpcTotals(mpc: StrategicPlan["mpc"] | undefined) {
  const fs = mpc?.factores ?? [];
  const sum = fs.reduce((a, f) => a + Math.max(0, Number(f.peso) || 0), 0) || 1;
  const totals = new Map<string, number>();
  for (const f of fs) {
    f.peso = Math.round((Math.max(0, Number(f.peso) || 0) / sum) * 1000) / 1000;
    for (const c of f.calificaciones) {
      c.calificacion = Math.min(4, Math.max(1, Math.round(Number(c.calificacion) || 1)));
      totals.set(c.empresa, (totals.get(c.empresa) ?? 0) + f.peso * c.calificacion);
    }
  }
  return [...totals].map(([empresa, t]) => ({ empresa, total: Math.round(t * 100) / 100 }));
}

/** Cuadrante BCG por ejes: crecimiento alto ≥ 10 %, participación relativa alta ≥ 1. */
export function bcgQuadrant(growth: number, share: number): BcgQuadrant {
  const g = growth >= 10, s = share >= 1;
  return g && s ? "estrella" : g ? "interrogante" : s ? "vaca" : "perro";
}

export async function runStrategic(id: number): Promise<void> {
  const s = get<StrategicRow>("SELECT * FROM strategic_analyses WHERE id = ?", id);
  if (!s) throw new Error(`Análisis estratégico ${id} no existe`);
  const log = (step: string, msg: string, level = "info") => logStrategic(id, step, msg, level);
  const t0 = Date.now();
  // Al agregar herramientas a un reporte existente se reutiliza lo ya generado (investigación incluida).
  const prev: Partial<StrategicResult> = s.result_json ? JSON.parse(s.result_json) : {};
  const plan: Partial<StrategicPlan> = { ...prev.plan };
  let research = prev.research;
  let efiTotal = prev.efiTotal, efeTotal = prev.efeTotal, ie = prev.ie, mpc = prev.mpcTotals;
  let cost = 0;
  const running = new Set<ModuleKey>();
  /** Guarda el resultado parcial para que la página en vivo muestre cada herramienta apenas está lista. */
  const save = (status: "running" | "completed" = "running") => {
    if (!research) return;
    const result: StrategicResult = {
      research, plan, efiTotal, efeTotal, ie, mpcTotals: mpc, validaciones: prev.validaciones,
      running: status === "running" ? [...running] : undefined,
      meta: { costUsd: ((prev.meta?.costUsd ?? 0) + cost) || undefined, durationMs: (prev.meta?.durationMs ?? 0) + Date.now() - t0, provider: prev.meta?.provider ?? s.provider ?? undefined },
    };
    run(`UPDATE strategic_analyses SET result_json=?${status === "completed" ? ", status='completed', finished_at=datetime('now')" : ""} WHERE id = ?`, JSON.stringify(result), id);
  };
  try {
    run("UPDATE strategic_analyses SET status='running', started_at=datetime('now'), finished_at=NULL, error=NULL WHERE id = ?", id);
    const company = get<Company>("SELECT * FROM companies WHERE id = ?", s.company_id);
    if (!company) throw new Error("Empresa no encontrada");
    const provider = getProvider(s.provider || undefined);
    const modules = parseModules(s.modules);
    const todo = modules.filter((k) => !moduleDone(k, { plan }));

    // 1. Planificación
    log("planificacion", `${research ? "Ampliando" : "Iniciando"} análisis estratégico de "${s.subject_name}" con el proveedor ${provider.name}.`);
    log("planificacion", `Herramientas a generar (${todo.length}):\n- ${todo.map((k) => moduleDef(k).label).join("\n- ") || "ninguna nueva"}`, "success");
    const ctx = s.subject_kind === "propia" ? internalContext(company) : undefined;
    const attachments: Attachment[] = s.doc_path && fs.existsSync(s.doc_path)
      ? [{ path: s.doc_path, name: "documento.pdf", mediaType: "application/pdf" }]
      : [];

    /** Una llamada al agente con validación y un reintento; acumula costo. */
    const ask = async <T,>(logStep: string, label: string, opts: Omit<RunStructuredOpts, "label" | "onProgress">, valid: (d: T) => boolean): Promise<T> => {
      let lastErr: unknown;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const res = await provider.runStructured<T>({ ...opts, label, onProgress: (m) => log(logStep, m) });
          cost += res.costUsd || 0;
          if (!res.data || !valid(res.data)) throw new Error("respuesta con formato inválido");
          return res.data;
        } catch (e) {
          lastErr = e;
          log(logStep, `${label}: intento ${attempt} falló: ${(e as Error).message}`, "warn");
        }
      }
      throw lastErr;
    };

    // 2. Investigación (solo la primera vez)
    if (!research) {
      const sources = [
        s.website_url && `sitio web (${s.website_url})`,
        s.doc_name && `documento "${s.doc_name}"`,
        ctx && `datos internos de Compa (${ctx.products.length} ítems, ${ctx.priceLines.length} análisis de precios)`,
        "búsqueda web del sector y del macroentorno",
      ].filter(Boolean);
      log("planificacion", `Fuentes a usar:\n- ${sources.join("\n- ")}`, "success");
      log("investigacion", "El agente investiga a la organización, su competencia y el entorno PESTEL en la web…");
      const r = await ask<Research>("investigacion", "research", {
        prompt: researchPrompt(s, ctx, attachments[0]?.name), schema: RESEARCH_SCHEMA, useWebTools: true, attachments,
      }, (d) => !!d.perfil);
      research = r;
      save();
      log("investigacion", `Investigación lista: ${r.competidores.length} competidores, ${r.entorno.length} datos del entorno, ${r.fuentes.length} fuentes${r.hallazgos_documento.length ? `, ${r.hallazgos_documento.length} hallazgos del documento` : ""}.`, "success");
    } else log("investigacion", "Se reutiliza la investigación ya realizada.", "success");
    const res = research;

    // 3. Análisis estratégico, por partes: cada paso tiene un esquema pequeño (la API rechaza gramáticas demasiado
    // grandes), pide solo las herramientas elegidas y recibe lo decidido en los anteriores.
    const SCHEMAS: Record<StrategicStep, JsonSchema> = {
      identidad: IDENTITY_SCHEMA, entorno: ENVIRONMENT_SCHEMA, foda: SWOT_SCHEMA, portafolio: PORTFOLIO_SCHEMA,
      direccion: DIRECTION_SCHEMA, plan: PLAN_SCHEMA, informe: REPORT_SCHEMA,
    };
    const stepModules = (st: StrategicStep) => todo.filter((k) => moduleDef(k).step === st);
    const steps = (["identidad", "entorno", "foda", "portafolio", "direccion", "plan", "informe"] as const).filter((st) => stepModules(st).length);
    let n = 0;
    const step = async (name: StrategicStep, prior: Record<string, unknown>) => {
      const mods = stepModules(name);
      if (!mods.length) return;
      const fields = mods.flatMap((k) => moduleDef(k).fields as string[]);
      log("analisis", `Paso ${++n}/${steps.length}: ${mods.map((k) => moduleDef(k).label).join(", ")}…`);
      mods.forEach((k) => running.add(k)); save();
      const data = await ask<Partial<StrategicPlan>>("analisis", `strategic-${name}`, {
        prompt: strategicStepPrompt(name, s, res, ctx, prior, fields), schema: pickSchema(SCHEMAS[name], fields), useWebTools: false,
      }, (d) => fields.every((f) => (d as Record<string, unknown>)[f] != null));
      Object.assign(plan, data);
      mods.forEach((k) => running.delete(k));
      return mods;
    };

    await Promise.all([
      step("identidad", {}).then((m) => {
        if (!m) return;
        save();
        log("analisis", "Identidad y modelo de negocio listos.", "success");
        const short = (plan.cadena_valor ?? []).filter((a) => (a.procesos?.length ?? 0) < 5);
        if (m.includes("cadena_valor") && short.length) log("analisis", `Cadena de valor: ${short.map((a) => a.actividad).join(", ")} con menos de 5 procesos.`, "warn");
      }),
      step("entorno", {}).then((m) => {
        if (!m) return;
        if (plan.mpc && m.includes("mpc")) mpc = mpcTotals(plan.mpc);
        save();
        log("analisis", `Entorno listo${plan.pestel ? `: ${plan.pestel.length} factores PESTEL` : ""}.${mpc?.length ? ` MPC: ${mpc.map((x) => `${x.empresa} ${x.total}`).join(", ")}.` : ""}`, "success");
      }),
    ]);

    const swotMods = await step("foda", { mision: plan.mision, valores: plan.valores, canvas: plan.canvas, cadena_valor: plan.cadena_valor, pestel: plan.pestel, porter: plan.porter, mpc: plan.mpc });
    if (swotMods && plan.matriz_efi && plan.matriz_efe) {
      efiTotal = weigh([plan.matriz_efi.fortalezas, plan.matriz_efi.debilidades]);
      efeTotal = weigh([plan.matriz_efe.oportunidades, plan.matriz_efe.amenazas]);
      ie = ieCell(efiTotal, efeTotal);
      save();
      log("analisis", `EFI = ${efiTotal}, EFE = ${efeTotal} → matriz IE cuadrante ${ie.cuadrante} (${ie.estrategia}).`, "success");
    }

    // Los pasos siguientes reciben un resumen (no todo lo anterior) para mantener el prompt acotado.
    const diagnosis = {
      foda: plan.foda, efi_total: efiTotal, efe_total: efeTotal, matriz_ie: ie,
      porter_conclusion: plan.porter?.conclusion, mpc_totales: mpc, mision: plan.mision?.texto,
    };
    const portMods = await step("portafolio", diagnosis);
    if (portMods) {
      for (const u of plan.bcg?.unidades ?? []) {
        u.crecimiento_mercado = Number(u.crecimiento_mercado) || 0;
        u.participacion_relativa = Math.max(0, Number(u.participacion_relativa) || 0);
        u.cuadrante = bcgQuadrant(u.crecimiento_mercado, u.participacion_relativa);
      }
      save();
      log("analisis", "Portafolio y crecimiento listos.", "success");
    }

    const portfolio = {
      bcg: plan.bcg?.unidades.map((u) => ({ unidad: u.unidad, cuadrante: u.cuadrante, estrategia: u.estrategia })),
      ansoff_recomendada: plan.ansoff?.recomendada, ansoff_justificacion: plan.ansoff?.justificacion,
    };
    const dirMods = await step("direccion", {
      ...diagnosis, ...portfolio,
      matriz_efi: plan.matriz_efi, matriz_efe: plan.matriz_efe,
      cadena_valor: plan.cadena_valor?.map((a) => ({ actividad: a.actividad, evaluacion: a.evaluacion })),
    });
    if (dirMods) { save(); log("analisis", `Dirección estratégica lista: estrategia general de ${plan.direccion?.estrategia_general.tipo.toLowerCase()}, ${plan.direccion?.estrategias_negocio.length ?? 0} estrategias de negocio.`, "success"); }

    const direction = plan.direccion && {
      estrategia_general: plan.direccion.estrategia_general.tipo, estrategia_competitiva: plan.direccion.estrategia_competitiva.tipo,
      estrategias_negocio: plan.direccion.estrategias_negocio.map((e) => `${e.categoria}: ${e.nombre}`),
    };
    const planMods = await step("plan", { ...diagnosis, ...portfolio, direccion: direction });
    if (planMods) { save(); log("analisis", `Plan listo: ${plan.estrategias?.length ?? 0} estrategias con KPI.`, "success"); }

    // El informe integra todo lo generado, resumido para que el prompt no crezca de más.
    const repMods = await step("informe", {
      ...diagnosis, ...portfolio,
      vision: plan.vision?.texto, valores: plan.valores, propuesta_valor: plan.canvas?.propuesta_valor,
      cadena_valor: plan.cadena_valor?.map((a) => ({ actividad: a.actividad, evaluacion: a.evaluacion, analisis: a.analisis })),
      pestel: plan.pestel, mpc_conclusion: plan.mpc?.conclusion, bcg_conclusion: plan.bcg?.conclusion,
      direccion: plan.direccion, objetivos_estrategicos: plan.objetivos_estrategicos,
      estrategias: plan.estrategias?.map((e) => ({ tipo: e.tipo, titulo: e.titulo, kpi: e.kpi.nombre, meta: e.kpi.meta, fuente: e.kpi.fuente_informacion })),
      resumen_ejecutivo: plan.resumen_ejecutivo,
    });
    if (repMods) log("analisis", "Informe de gestión e informe ejecutivo listos.", "success");

    // Fase III: agentes especializados sobre los resultados anteriores (S/TD, Pareto, presupuesto, KPI, investigación,
    // brechas, estrategias de transformación digital e informes integrados).
    await runTdAgents({ s, research: res, plan, todo, ask, save, log, running, validated: Object.keys(prev.validaciones ?? {}) });

    // 4. Guardado
    log("guardado", "Guardando reporte…");
    save("completed");
    log("guardado", `Análisis completado en ${((Date.now() - t0) / 1000).toFixed(1)}s.`, "success");
  } catch (e) {
    const msg = (e as Error).message || String(e);
    running.clear();
    try { save(); } catch { /* se conserva lo último guardado */ }
    logStrategic(id, "error", msg, "error");
    run("UPDATE strategic_analyses SET status='failed', finished_at=datetime('now'), error=? WHERE id = ?", msg, id);
  }
}
