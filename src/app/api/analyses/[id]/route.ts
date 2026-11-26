import { all, get } from "@/lib/db";
import { apiSession, json } from "@/lib/api";
import type { AnalysisRow, LogRow } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = await apiSession();
  if ("error" in r) return r.error;
  const id = Number((await params).id);
  const a = get<AnalysisRow>("SELECT * FROM analyses WHERE id = ? AND company_id = ?", id, r.session.company.id);
  if (!a) return json({ error: "No encontrado" }, 404);
  const after = Number(new URL(req.url).searchParams.get("after") || 0);
  const logs = all<LogRow>("SELECT * FROM agent_logs WHERE analysis_id = ? AND id > ? ORDER BY id", id, after);
  return json({ id, status: a.status, error: a.error, started_at: a.started_at, finished_at: a.finished_at, logs });
}
