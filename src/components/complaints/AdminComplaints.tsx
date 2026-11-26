"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Complaint } from "@/lib/complaints";
import { ComplaintSheet, type ProviderInfo } from "./ComplaintSheet";

const DAY = 86_400_000;
function Due({ c, now }: { c: Complaint; now: number }) {
  if (c.status === "respondido") {
    const onTime = (c.respondedAt ?? 0) <= c.dueAt;
    return <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${onTime ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>{onTime ? "Respondida a tiempo" : "Respondida fuera de plazo"}</span>;
  }
  const left = Math.ceil((c.dueAt - now) / DAY);
  const cls = left < 0 ? "border-red-200 bg-red-50 text-red-800" : left <= 3 ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-100 text-slate-700";
  return <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{left < 0 ? `Vencida hace ${-left} d` : `Vence en ${left} d`}</span>;
}

export function AdminComplaints({ items, provider, now }: { items: Complaint[]; provider: ProviderInfo; now: number }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");
  async function answer(id: number) {
    setBusy(id); setError("");
    const r = await fetch(`/api/complaints/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ response: drafts[id] ?? "" }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setError(j.error || "No se pudo guardar la respuesta."); else router.refresh();
    setBusy(null);
  }
  if (!items.length) return <div className="card border-dashed p-8 text-center text-sm text-soft">No hay hojas registradas.</div>;
  return (
    <div className="space-y-3">
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-bad">{error}</p>}
      {items.map((c) => (
        <details key={c.id} className="card p-4" open={c.status === "recibido" && c.dueAt - now < 3 * DAY}>
          <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
            <span><strong className="tabular-nums">N.º {c.code}</strong> · {c.kind === "reclamo" ? "Reclamo" : "Queja"} · {c.consumerName}</span>
            <Due c={c} now={now} />
          </summary>
          <div className="mt-4 space-y-4">
            <ComplaintSheet c={c} provider={provider} />
            {c.status === "recibido" && <div className="space-y-2">
              <label className="label" htmlFor={`ans-${c.id}`}>Respuesta al consumidor (se envía por {c.responseChannel === "email" ? `correo a ${c.email}` : "carta al domicilio"})</label>
              <textarea id={`ans-${c.id}`} rows={4} minLength={10} maxLength={3000} className="input" value={drafts[c.id] ?? ""} onChange={(e) => setDrafts({ ...drafts, [c.id]: e.target.value })} />
              <button type="button" className="btn btn-primary" disabled={busy === c.id} onClick={() => void answer(c.id)}>{busy === c.id ? "Guardando…" : "Registrar respuesta"}</button>
            </div>}
          </div>
        </details>
      ))}
    </div>
  );
}
