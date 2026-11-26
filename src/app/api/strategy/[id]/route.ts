import fs from "node:fs";
import { all, get, run } from "@/lib/db";
import { apiSession, json } from "@/lib/api";
import { enqueueStrategic } from "@/lib/agent/queue";
import { normalizeModules, parseModules } from "@/lib/strategy-modules";
import { deleteDocFiles } from "@/lib/td-docs";
import type { LogRow, StrategicRow } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = await apiSession();
  if ("error" in r) return r.error;
  const id = Number((await params).id);
  const a = get<StrategicRow>("SELECT * FROM strategic_analyses WHERE id = ? AND company_id = ?", id, r.session.company.id);
  if (!a) return json({ error: "No encontrado" }, 404);
  const after = Number(new URL(req.url).searchParams.get("after") || 0);
  const logs = all<LogRow>("SELECT * FROM strategic_logs WHERE strategic_id = ? AND id > ? ORDER BY id", id, after);
  // El resultado parcial solo viaja cuando cambió (rv = largo del JSON que ya tiene el cliente).
  const rv = a.result_json?.length ?? 0;
  const changed = Number(new URL(req.url).searchParams.get("rv") ?? -1) !== rv;
  return json({
    id, status: a.status, error: a.error, started_at: a.started_at, finished_at: a.finished_at, logs,
    modules: parseModules(a.modules), rv, result: changed && a.result_json ? JSON.parse(a.result_json) : undefined,
  });
}

/** Agrega herramientas a un análisis terminado (o reintenta las que faltaron) reutilizando lo ya generado. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = await apiSession();
  if ("error" in r) return r.error;
  const id = Number((await params).id);
  const a = get<StrategicRow>("SELECT * FROM strategic_analyses WHERE id = ? AND company_id = ?", id, r.session.company.id);
  if (!a) return json({ error: "No encontrado" }, 404);
  if (a.status === "queued" || a.status === "running") return json({ error: "El análisis ya está en curso" }, 409);
  const active = get<{ id: number }>("SELECT id FROM strategic_analyses WHERE company_id = ? AND status IN ('queued','running')", r.session.company.id);
  if (active) return json({ error: "Ya hay otro análisis estratégico en curso; espera a que termine" }, 409);
  const body = await req.json().catch(() => ({}));
  const extra = Array.isArray(body.modules) ? body.modules : [];
  const modules = normalizeModules([...parseModules(a.modules), ...extra]);
  run("UPDATE strategic_analyses SET modules = ?, status = 'queued', error = NULL WHERE id = ?", JSON.stringify(modules), id);
  enqueueStrategic(id);
  return json({ id, modules });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = await apiSession();
  if ("error" in r) return r.error;
  const id = Number((await params).id);
  const a = get<StrategicRow>("SELECT * FROM strategic_analyses WHERE id = ? AND company_id = ?", id, r.session.company.id);
  if (!a) return json({ error: "No encontrado" }, 404);
  if (a.status === "queued" || a.status === "running") return json({ error: "Espera a que termine el análisis" }, 409);
  deleteDocFiles(id);
  run("DELETE FROM strategic_analyses WHERE id = ?", id);
  if (a.doc_path) fs.rmSync(a.doc_path, { force: true });
  return json({ ok: true });
}
