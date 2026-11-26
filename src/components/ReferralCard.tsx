"use client";
import { useState } from "react";
import type { ReferralSummary } from "@/lib/referrals";

/** Programa de referidos: un mes adicional por cada empresa invitada que pague su primer plan. */
export function ReferralCard({ summary, link }: { summary: ReferralSummary; link: string | null }) {
  const [copied, setCopied] = useState(false);
  const share = link ?? summary.code;
  async function copy() {
    try { await navigator.clipboard.writeText(share); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); }
  }
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`Te recomiendo Compa para comparar tus precios con la competencia. Regístrate con mi código ${summary.code}${link ? `: ${link}` : ""}`)}`;
  return (
    <section className="card mt-5 p-5">
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr] lg:items-center">
        <div>
          <p className="eyebrow">Invita y gana</p>
          <h2 className="display mt-1 text-xl font-bold">Un mes gratis por cada empresa que invites</h2>
          <p className="mt-1 text-sm text-soft">Cuando una empresa se registra con tu código y paga su primer plan, tu plan suma {summary.rewardDays} días. Si no tienes un plan vigente, recibes el plan Emprendedor. Hasta {summary.maxRewards} recompensas.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="rounded-lg border border-line bg-[#f6f5f1] px-3 py-2 text-sm font-semibold tracking-wide">{summary.code}</code>
            <button type="button" className="btn btn-ghost" onClick={() => void copy()}>{copied ? "¡Copiado!" : link ? "Copiar enlace" : "Copiar código"}</button>
            <a className="btn btn-ghost" href={whatsapp} target="_blank" rel="noreferrer">Compartir por WhatsApp</a>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-3 text-center">
          {[["Invitadas", summary.invited], ["Con pago", summary.rewarded], ["Días ganados", summary.daysEarned]].map(([l, v]) => (
            <div key={String(l)} className="rounded-lg bg-[#f6f5f1] p-3"><dt className="text-[11px] uppercase tracking-wide text-soft">{l}</dt><dd className="display text-2xl font-bold tabular-nums">{v}</dd></div>
          ))}
        </dl>
      </div>
    </section>
  );
}
