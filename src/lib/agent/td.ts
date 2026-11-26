// Orquestación de los agentes de la fase III. Se ejecuta al final de runStrategic, sobre el mismo análisis:
// reutiliza la investigación y lo ya generado (no vuelve a pedir datos) y guarda cada resultado apenas está listo.
import fs from "node:fs";
import type { ModuleKey } from "../strategy-modules";
import { moduleDef } from "../strategy-modules";
import {
  computePareto, gapIndex, kpiCoverage, literatureStats, sanitizeBudget, sanitizeDigital, sanitizeGaps, sanitizeKpis,
  sanitizeLiterature, sanitizeOperationalization, sanitizePareto, sanitizeStd,
} from "../td";
import { listDocs } from "../td-docs";
import type {
  DigitalStrategies, GapDiagnosis, KpiDesign, Literature, Operationalization, ParetoAnalysis, Research, StdMatrix, StrategicPlan,
  StrategicRow, TdExecutiveReport, TdManagementReport, TechBudget,
} from "../types";
import {
  budgetPrompt, digitalPrompt, gapsPrompt, kpiPrompt, literaturePrompt, operationalizationPrompt, paretoPrompt, stdPrompt, tdReportPrompt,
  type DocForPrompt,
} from "./td-prompts";
import {
  BUDGET_SCHEMA, DIGITAL_SCHEMA, GAPS_SCHEMA, KPI_SCHEMA, LITERATURE_SCHEMA, OPERATIONALIZATION_SCHEMA, PARETO_SCHEMA, STD_SCHEMA, TD_REPORT_SCHEMA, pickTd,
} from "./td-schemas";
import type { Attachment, RunStructuredOpts } from "./types";

type Ask = <T>(logStep: string, label: string, opts: Omit<RunStructuredOpts, "label" | "onProgress">, valid: (d: T) => boolean) => Promise<T>;
export type TdContext = {
  s: StrategicRow; research: Research; plan: Partial<StrategicPlan>; todo: ModuleKey[];
  ask: Ask; save: () => void; log: (step: string, msg: string, level?: string) => void; running: Set<ModuleKey>;
  validated: string[];
};

const DEFAULT_PE_FRAMEWORK = "Política Nacional de Transformación Digital al 2030";

export async function runTdAgents(c: TdContext): Promise<void> {
  const { s, research, plan, ask, log } = c;
  const want = (k: ModuleKey) => c.todo.includes(k);
  if (!c.todo.some((k) => moduleDef(k).agent)) return;
  const failures: string[] = [];
  const warn = (ws: string[]) => ws.forEach((w) => log("analisis", w, "warn"));

  /** Ejecuta un agente: lo marca "en curso", guarda su resultado y registra el error sin detener a los demás. */
  const agent = async (keys: ModuleKey[], fn: () => Promise<void>) => {
    const ks = keys.filter(want);
    if (!ks.length) return;
    const def = moduleDef(ks[0]);
    log("analisis", `Agente ${def.agent} · ${ks.map((k) => moduleDef(k).label).join(" e ")}…`);
    ks.forEach((k) => c.running.add(k)); c.save();
    try {
      await fn();
      log("analisis", `${ks.map((k) => moduleDef(k).label).join(" e ")}: listo.`, "success");
    } catch (e) {
      failures.push(ks.map((k) => moduleDef(k).label).join(", "));
      log("analisis", `Agente ${def.agent}: ${(e as Error).message}`, "error");
    } finally {
      ks.forEach((k) => c.running.delete(k)); c.save();
    }
  };

  // Rama A: despliegue (S/TD → Pareto → presupuesto) con KPI en paralelo.
  const deployment = async () => {
    await agent(["std"], async () => {
      const d = await ask<{ std: StdMatrix }>("analisis", "strategic-td-std", { prompt: stdPrompt(s, research, plan), schema: STD_SCHEMA, useWebTools: false }, (x) => !!x.std?.filas?.length);
      const r = sanitizeStd(d.std, plan); plan.std = r.data; warn(r.warnings);
      log("analisis", `S/TD: ${r.data.filas.length} estrategias vinculadas (${r.data.filas.filter((f) => f.situacion === "nueva").length} requieren tecnología nueva).`);
    });
    if (plan.std) await agent(["pareto"], async () => {
      const d = await ask<{ pareto: ParetoAnalysis }>("analisis", "strategic-td-pareto", { prompt: paretoPrompt(s, research, plan), schema: PARETO_SCHEMA, useWebTools: false }, (x) => !!x.pareto?.evaluaciones?.length);
      const r = sanitizePareto(d.pareto, plan.std); plan.pareto = r.data; warn(r.warnings);
      log("analisis", `Pareto: ${computePareto(r.data, plan.std).mensaje}`);
    });
    if (plan.pareto && plan.std) await agent(["presupuesto"], async () => {
      const d = await ask<{ presupuesto: TechBudget }>("analisis", "strategic-td-presupuesto", { prompt: budgetPrompt(s, research, plan), schema: BUDGET_SCHEMA, useWebTools: true }, (x) => !!x.presupuesto?.partidas?.length);
      // El presupuesto disponible lo registra la organización: se conserva el que ya tenía.
      const r = sanitizeBudget({ ...d.presupuesto, disponible: plan.presupuesto?.disponible ?? null }); plan.presupuesto = r.data; warn(r.warnings);
      log("analisis", `Presupuesto: ${r.data.partidas.length} partidas, ${r.data.partidas.filter((x) => x.origen === "fuente").length} con precio de fuente pública.`);
    });
  };
  const indicators = () => agent(["kpis"], async () => {
    const d = await ask<{ kpis: KpiDesign }>("analisis", "strategic-td-kpis", { prompt: kpiPrompt(s, research, plan), schema: KPI_SCHEMA, useWebTools: false }, (x) => !!x.kpis?.indicadores?.length);
    const r = sanitizeKpis(d.kpis, plan); plan.kpis = r.data; warn(r.warnings);
    const cov = kpiCoverage(r.data, plan);
    log("analisis", `KPI: ${cov.total} indicadores; ${cov.pendientes} con línea base pendiente.`);
  });

  // Rama B: transformación digital (brechas → estrategias de TD) e investigación científica.
  const transformation = async () => {
    await agent(["brechas"], async () => {
      const { docs, attachments, marco } = gapDocuments(s);
      log("analisis", `Documentos: ${docs.map((d) => `${d.name} (${d.role})`).join("; ") || "ninguno subido"} · marco de referencia: ${marco}.`);
      const d = await ask<{ brechas: GapDiagnosis }>("analisis", "strategic-td-brechas", {
        prompt: gapsPrompt(s, research, docs, marco), schema: GAPS_SCHEMA, useWebTools: true, attachments,
      }, (x) => !!x.brechas?.filas?.length);
      const r = sanitizeGaps(d.brechas); plan.brechas = r.data; warn(r.warnings);
      log("analisis", `Brechas: índice de alineamiento ${gapIndex(r.data).indice} % en ${r.data.filas.length} lineamientos; ${r.data.problemas.length} problemas de investigación.`);
    });
    await Promise.all([
      plan.brechas && agent(["estrategias_td"], async () => {
        const d = await ask<{ estrategias_td: DigitalStrategies }>("analisis", "strategic-td-estrategias", { prompt: digitalPrompt(s, research, plan), schema: DIGITAL_SCHEMA, useWebTools: false }, (x) => !!x.estrategias_td?.propuestas?.length);
        const r = sanitizeDigital(d.estrategias_td, plan.brechas); plan.estrategias_td = r.data; warn(r.warnings);
      }),
      agent(["investigacion"], async () => {
        const year = new Date().getFullYear();
        const d = await ask<{ literatura: Literature }>("analisis", "strategic-td-literatura", { prompt: literaturePrompt(s, plan, year), schema: LITERATURE_SCHEMA, useWebTools: true }, (x) => !!x.literatura?.referencias?.length);
        const r = sanitizeLiterature(d.literatura); plan.literatura = r.data; warn(r.warnings);
        const st = literatureStats(r.data, year);
        log("analisis", `Literatura: ${st.total} referencias (${st.consultadas} consultadas, ${st.recientes} desde ${st.desde}).`);
        if (!st.cumpleMinimo) log("analisis", `No se alcanzaron 3 referencias en cada área: ${st.byArea.filter((a) => a.total < 3).map((a) => `área ${a.area} (${a.total})`).join(", ")}.`, "warn");
        c.save();
        const o = await ask<{ operacionalizacion: Operationalization }>("analisis", "strategic-td-operacionalizacion", { prompt: operationalizationPrompt(s, plan), schema: OPERATIONALIZATION_SCHEMA, useWebTools: false }, (x) => !!x.operacionalizacion?.variables?.length);
        const r2 = sanitizeOperationalization(o.operacionalizacion, plan.literatura, undefined); plan.operacionalizacion = r2.data; warn(r2.warnings);
      }),
    ]);
  };

  await Promise.all([deployment(), indicators(), transformation()]);

  // Agente 8: consolida lo generado (requiere S/TD, Pareto, presupuesto y KPI).
  const reports = (["informe_gestion_td", "informe_ejecutivo_td"] as ModuleKey[]).filter(want);
  if (reports.length && plan.std && plan.pareto && plan.presupuesto && plan.kpis) {
    await agent(reports, async () => {
      const fields = reports as string[];
      const d = await ask<{ informe_gestion_td?: TdManagementReport; informe_ejecutivo_td?: TdExecutiveReport }>("analisis", "strategic-td-informe", {
        prompt: tdReportPrompt(s, research, plan, fields, c.validated), schema: pickTd(TD_REPORT_SCHEMA, fields), useWebTools: false,
      }, (x) => fields.every((f) => (x as Record<string, unknown>)[f] != null));
      Object.assign(plan, d);
    });
  } else if (reports.length) failures.push("Informes integrados (faltan S/TD, Pareto, presupuesto o KPI)");

  if (failures.length) throw new Error(`Agentes con error: ${failures.join("; ")}. Usa "Reintentar lo que falta".`);
}

/** Documentos para el diagnóstico de brechas: los subidos al análisis y, si no hay institucional, el documento original. */
function gapDocuments(s: StrategicRow): { docs: DocForPrompt[]; attachments: Attachment[]; marco: string } {
  const rows = listDocs(s.id);
  const docs: DocForPrompt[] = [];
  const attachments: Attachment[] = [];
  const add = (role: DocForPrompt["role"], name: string, text: string | null, path: string | null, url: string | null) => {
    if (path && fs.existsSync(path)) {
      const file = `${role}-${attachments.length + 1}.pdf`;
      attachments.push({ path, name: file, mediaType: "application/pdf" });
      docs.push({ role, name, file });
    } else docs.push({ role, name, text, url });
  };
  if (!rows.some((d) => d.role === "institucional") && (s.doc_text || s.doc_path))
    add("institucional", s.doc_name || "Documento del análisis", s.doc_text, s.doc_path, null);
  for (const d of rows) add(d.role, d.name, d.text_content, d.path, d.url);
  const ref = rows.find((d) => d.role === "referencia");
  const marco = ref?.name || (/per[uú]/i.test(s.country || "") ? DEFAULT_PE_FRAMEWORK : "la política o estrategia nacional de transformación digital vigente del país");
  return { docs, attachments, marco };
}
