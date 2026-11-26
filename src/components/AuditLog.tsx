import { AUDIT_LABEL, type AuditRow } from "@/lib/audit";

const when = (iso: string) => new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Lima" }).format(new Date(iso));
const RISKY = new Set(["auth.login_failed", "2fa.disable", "account.delete", "billing.refund"]);

/** Actividad reciente de la cuenta: permite al cliente detectar accesos o cambios que no reconoce. */
export function AuditLog({ rows, scope }: { rows: AuditRow[]; scope: "empresa" | "usuario" }) {
  return (
    <section className="card mt-5 p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><h2 className="font-semibold">Actividad de la cuenta</h2><p className="text-sm text-soft">Últimos eventos {scope === "empresa" ? "de tu empresa" : "de tu usuario"}: accesos, cambios, pagos e importaciones. Se conservan un año.</p></div>
      </div>
      {rows.length === 0 ? <p className="mt-3 text-sm text-soft">Aún no hay eventos registrados.</p> : (
        <div className="mt-3 overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-soft"><th className="py-2 pr-3">Fecha</th><th className="py-2 pr-3">Evento</th><th className="py-2 pr-3">Usuario</th><th className="py-2 pr-3">Detalle</th><th className="py-2">IP</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id} className="border-b border-line/70 align-top">
              <td className="whitespace-nowrap py-2 pr-3 text-soft">{when(r.created_at)}</td>
              <td className={`py-2 pr-3 font-medium ${RISKY.has(r.action) ? "text-bad" : ""}`}>{AUDIT_LABEL[r.action] ?? r.action}</td>
              <td className="py-2 pr-3">{r.user_name ?? "Sistema"}</td>
              <td className="py-2 pr-3 text-soft">{r.detail ?? "—"}</td>
              <td className="py-2 tabular-nums text-soft">{r.ip ?? "—"}</td>
            </tr>))}</tbody>
        </table></div>
      )}
    </section>
  );
}
