"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Transparencia y supervisión humana: el reporte declara que lo generó una IA y quién lo revisó. */
export function AiReviewNotice({ kind, id, reviewedBy, reviewedAt }: { kind: "analysis" | "strategic"; id: number; reviewedBy: string | null; reviewedAt: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function confirm() {
    setBusy(true); setError("");
    const r = await fetch("/api/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, id }) });
    if (r.ok) router.refresh();
    else { setError((await r.json().catch(() => ({}))).error || "No se pudo registrar la revisión."); }
    setBusy(false);
  }
  return (
    <aside aria-label="Aviso sobre inteligencia artificial" className={`mb-4 rounded-lg border px-4 py-3 text-sm ${reviewedBy ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 flex-1 basis-72">
          <strong>Elaborado con inteligencia artificial.</strong>{" "}
          {reviewedBy
            ? <>Revisado por {reviewedBy} el {new Date(`${reviewedAt}Z`).toLocaleDateString("es-PE", { timeZone: "America/Lima", dateStyle: "medium" })}. La decisión final corresponde a la empresa.</>
            : <>Pendiente de revisión humana. Comprueba las fuentes y las cifras antes de tomar una decisión.</>}
        </p>
        {!reviewedBy && <button type="button" disabled={busy} onClick={() => void confirm()} className="btn btn-ghost no-print">{busy ? "Registrando…" : "Marcar como revisado"}</button>}
      </div>
      {error && <p role="alert" className="mt-2 text-bad">{error}</p>}
    </aside>
  );
}
