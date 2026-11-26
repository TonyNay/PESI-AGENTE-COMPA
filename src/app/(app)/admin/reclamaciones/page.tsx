import { notFound } from "next/navigation";
import { AdminComplaints } from "@/components/complaints/AdminComplaints";
import { Kpi, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { complaintStats, listComplaints } from "@/lib/complaints";
import { isPlatformAdmin, providerInfo } from "@/lib/platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminComplaintsPage() {
  const { user } = await requireSession();
  if (!isPlatformAdmin(user.email)) notFound();
  const stats = complaintStats();
  const now = Date.now();
  return <>
    <PageHeader eyebrow="Administración de Compa" title="Libro de Reclamaciones" sub="Hojas recibidas y su plazo de 15 días hábiles. Las más próximas a vencer aparecen primero." />
    <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Kpi label="Hojas registradas" value={stats.total} />
      <Kpi label="Pendientes" value={stats.open} tone={stats.open ? "warn" : undefined} />
      <Kpi label="Vencidas sin respuesta" value={stats.overdue} tone={stats.overdue ? "bad" : "good"} />
      <Kpi label="Respondidas a tiempo" value={stats.answered ? `${Math.round((stats.answeredOnTime / stats.answered) * 100)} %` : "—"} hint={`${stats.answeredOnTime} de ${stats.answered}`} />
    </div>
    <AdminComplaints items={listComplaints()} provider={providerInfo()} now={now} />
  </>;
}
