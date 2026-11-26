import { apiSession, json } from "@/lib/api";
import { get, run } from "@/lib/db";
import { enqueueStrategic } from "@/lib/agent/queue";
import { isModuleKey, moduleDef, normalizeModules, parseModules, type ModuleKey } from "@/lib/strategy-modules";
import {
  sanitizeBudget, sanitizeDigital, sanitizeGaps, sanitizeKpis, sanitizeLiterature, sanitizeOperationalization, sanitizePareto, sanitizeStd,
} from "@/lib/td";
import type { StrategicPlan, StrategicResult, StrategicRow } from "@/lib/types";

export const runtime = "nodejs";

/** Herramientas de la fase III cuyos resultados el usuario puede editar y guardar (campo del plan que reemplaza). */
const EDITABLE: Partial<Record<ModuleKey, keyof StrategicPlan>> = {
  std: "std", pareto: "pareto", presupuesto: "presupuesto", kpis: "kpis", brechas: "brechas", estrategias_td: "estrategias_td",
};

/**
 * Acciones sobre los resultados de los agentes de la fase III:
 * - save: guarda lo editado (se valida y se recalcula en el servidor; quita la validación previa de esa herramienta).
 * - validate: marca (o desmarca) la herramienta como revisada y validada por una persona.
 * - regenerate: descarta el resultado de la herramienta y vuelve a ejecutar su agente.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = await apiSession();
  if ("error" in r) return r.error;
  const id = Number((await params).id);
  const a = get<StrategicRow>("SELECT * FROM strategic_analyses WHERE id = ? AND company_id = ?", id, r.session.company.id);
  if (!a) return json({ error: "No encontrado" }, 404);
  if (a.status === "queued" || a.status === "running") return json({ error: "Espera a que termine el trabajo en curso" }, 409);
  if (!a.result_json) return json({ error: "El análisis aún no tiene resultados" }, 409);
  const body = await req.json().catch(() => ({}));
  const key = String(body.module ?? "");
  if (!isModuleKey(key) || !moduleDef(key).agent) return json({ error: "Herramienta no válida" }, 400);
  const result: StrategicResult = JSON.parse(a.result_json);
  const plan = result.plan;
  const vals = { ...(result.validaciones ?? {}) };
  let warnings: string[] = [];

  if (body.action === "validate") {
    if (moduleDef(key).fields.some((f) => plan[f] == null)) return json({ error: "La herramienta aún no se generó" }, 409);
    if (body.on === false) delete vals[key];
    else vals[key] = { por: r.session.user.name, fecha: new Date().toISOString() };
  } else if (body.action === "save") {
    const data = body.data;
    if (!data || typeof data !== "object") return json({ error: "Datos inválidos" }, 400);
    if (key === "investigacion") {
      const lit = sanitizeLiterature(data.literatura ?? plan.literatura);
      plan.literatura = lit.data;
      if (plan.operacionalizacion) plan.operacionalizacion = sanitizeOperationalization(data.operacionalizacion ?? plan.operacionalizacion, lit.data, lit.remap).data;
      warnings = lit.warnings;
    } else {
      const field = EDITABLE[key];
      if (!field) return json({ error: "Esta herramienta no se edita aquí" }, 400);
      const s = (() => {
        switch (key) {
          case "std": return sanitizeStd(data, plan);
          case "pareto": return sanitizePareto(data, plan.std);
          case "presupuesto": return sanitizeBudget(data);
          case "kpis": return sanitizeKpis(data, plan);
          case "brechas": return sanitizeGaps(data);
          default: return sanitizeDigital(data, plan.brechas);
        }
      })();
      (plan as Record<string, unknown>)[field] = s.data;
      warnings = s.warnings;
    }
    delete vals[key];
  } else if (body.action === "regenerate") {
    for (const f of moduleDef(key).fields) delete plan[f];
    delete vals[key];
    const modules = normalizeModules([...parseModules(a.modules), key]);
    run("UPDATE strategic_analyses SET result_json = ?, modules = ?, status = 'queued', error = NULL WHERE id = ?",
      JSON.stringify({ ...result, plan, validaciones: vals }), JSON.stringify(modules), id);
    enqueueStrategic(id);
    return json({ queued: true, modules });
  } else return json({ error: "Acción no válida" }, 400);

  const next = { ...result, plan, validaciones: vals };
  run("UPDATE strategic_analyses SET result_json = ? WHERE id = ?", JSON.stringify(next), id);
  return json({ result: next, warnings });
}
