import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { all, get } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { parseModules } from "@/lib/strategy-modules";
import { PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import { AiReviewNotice } from "@/components/AiReviewNotice";
import { StrategicWorkspace } from "@/components/strategy/StrategicWorkspace";
import type { LogRow, StrategicResult, StrategicRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function StrategicReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { company } = await requireSession();
  const id = Number((await params).id);
  const a = get<StrategicRow>("SELECT * FROM strategic_analyses WHERE id = ? AND company_id = ?", id, company.id);
  if (!a) notFound();
  const logs = all<LogRow>("SELECT id, strategic_id AS analysis_id, ts, step, level, message FROM strategic_logs WHERE strategic_id = ? ORDER BY id", id);
  const result: StrategicResult | null = a.result_json ? JSON.parse(a.result_json) : null;
  const live = a.status === "queued" || a.status === "running";
  const sub = <>
    <Link href="/strategy" className="text-brand hover:underline">Volver</Link> · {a.subject_kind === "propia" ? "Mi empresa" : "Empresa externa"}
    {a.website_url && <> · <a className="text-brand hover:underline" href={a.website_url} target="_blank" rel="noreferrer noopener">{new URL(a.website_url).hostname.replace(/^www\./, "")} ↗</a></>}
    {a.doc_name && <> · {a.doc_name}</>} · {a.provider} · {fmtDate(a.finished_at || a.created_at)}
    {result?.meta?.costUsd != null && <> · costo ≈ US$ {result.meta.costUsd.toFixed(4)}</>}
  </>;

  return (<>
    <PageHeader eyebrow={live ? "Agente en acción" : a.status === "failed" ? "Análisis incompleto" : "Reporte de planeamiento estratégico"} title={a.subject_name} sub={sub}>
      {result && !live && <PrintButton />}
      <Link className="btn btn-ghost" href="/strategy">Nuevo análisis</Link>
    </PageHeader>
    {a.status === "completed" && <AiReviewNotice kind="strategic" id={id} reviewedBy={a.reviewed_by} reviewedAt={a.reviewed_at} />}
    <StrategicWorkspace id={id} subject={a.subject_name} initialStatus={a.status} initialResult={result}
      initialModules={parseModules(a.modules)} initialLogs={logs} initialError={a.error} docName={a.doc_name} country={a.country} />
    <p className="mt-8 text-xs text-soft">Generado por el agente Compa ({result?.meta?.provider ?? a.provider}). El diagnóstico se basa en fuentes públicas y en los datos entregados; las metas son propuestas y deben validarse con la empresa.</p>
  </>);
}
