import { requireSession } from "@/lib/auth";
import { all } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { MODULES, moduleDone, parseModules } from "@/lib/strategy-modules";
import { Empty, PageHeader } from "@/components/ui";
import { StrategyForm, StrategyList } from "@/components/StrategyClient";
import type { StrategicResult } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function StrategyPage() {
  const { company } = await requireSession();
  const rows = all<{ id: number; subject_name: string; subject_kind: string; website_url: string | null; doc_name: string | null; status: string; created_at: string; finished_at: string | null; modules: string | null; result_json: string | null }>(
    `SELECT id, subject_name, subject_kind, website_url, doc_name, status, created_at, finished_at, modules, result_json
     FROM strategic_analyses WHERE company_id = ? ORDER BY id DESC`, company.id).map(({ result_json, modules, created_at, finished_at, ...r }) => {
    const result: StrategicResult | null = result_json ? JSON.parse(result_json) : null;
    return { ...r, date: fmtDate(finished_at || created_at), modules: parseModules(modules), done: MODULES.filter((m) => moduleDone(m.key, result)).map((m) => m.key) };
  });
  return (
    <>
      <PageHeader eyebrow="Planeamiento estratégico" title="Análisis estratégico"
        sub="Elige qué herramientas aplicar —misión y visión, Canvas, cadena de valor, PESTEL, Porter, MPC, FODA con EFI/EFE e IE, BCG, Ansoff y estrategias con KPI— y, en la fase III, los agentes de S/TD, Pareto, presupuesto, KPI, investigación científica, brechas de transformación digital e informes integrados." />
      <StrategyForm defaults={{ name: company.name, industry: company.industry ?? "", country: company.country }} />
      <h2 className="mb-3 mt-8 font-semibold">Análisis realizados</h2>
      {rows.length === 0 ? <Empty>Aún no hay análisis estratégicos. Empieza por tu propia empresa.</Empty> : <StrategyList rows={rows} />}
    </>
  );
}
