"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

async function call(body: object) {
  const r = await fetch("/api/account/2fa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "No se pudo completar la solicitud.");
  return j;
}

export function TwoFactorCard({ status }: { status: { enabled: boolean; recoveryLeft: number } }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function act(e: FormEvent, action: () => Promise<void>) {
    e.preventDefault(); setBusy(true); setError("");
    try { await action(); setPassword(""); setCode(""); router.refresh(); }
    catch (err) { setError((err as Error).message); }
    setBusy(false);
  }
  const passwordField = <div><label className="label" htmlFor="tf-password">Tu contraseña</label><input id="tf-password" type="password" required autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} /></div>;
  const codeField = (label: string) => <div><label className="label" htmlFor="tf-code">{label}</label><input id="tf-code" required autoComplete="one-time-code" className="input" value={code} onChange={(e) => setCode(e.target.value)} /></div>;

  return (
    <section className="card space-y-3 p-5">
      <h2 className="font-semibold">Verificación en dos pasos</h2>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-bad">{error}</p>}
      {recovery ? <>
        <p className="text-sm font-medium">Activada. Guarda estos códigos de recuperación: solo se muestran ahora y cada uno sirve una vez si pierdes tu teléfono.</p>
        <ul className="grid grid-cols-1 gap-1 rounded-lg bg-[#fbfaf7] p-3 font-mono text-sm sm:grid-cols-2">{recovery.map((c) => <li key={c}>{c}</li>)}</ul>
        <button type="button" className="btn btn-primary" onClick={() => setRecovery(null)}>Ya los guardé</button>
      </> : status.enabled ? <>
        <p className="text-sm text-soft">Activada. Te quedan {status.recoveryLeft} códigos de recuperación.</p>
        <form onSubmit={(e) => void act(e, async () => { await call({ action: "disable", password, code }); })} className="space-y-3">
          {passwordField}
          {codeField("Código de la aplicación o de recuperación")}
          <button className="btn btn-ghost" disabled={busy}>{busy ? "Desactivando…" : "Desactivar"}</button>
        </form>
      </> : setup ? <>
        <p className="text-sm text-soft">Escanea el código con Google Authenticator u otra aplicación similar.</p>
        {/* eslint-disable-next-line @next/next/no-img-element -- imagen generada en el momento como data URL */}
        <img src={setup.qr} width={180} height={180} alt="Código QR para configurar la aplicación de autenticación" className="rounded-lg border border-line" />
        <p className="break-all text-xs text-soft">Si no puedes escanearlo, ingresa esta clave: <span className="font-mono">{setup.secret}</span></p>
        <form onSubmit={(e) => void act(e, async () => { const j = await call({ action: "confirm", code }); setRecovery(j.recoveryCodes); setSetup(null); })} className="space-y-3">
          {codeField("Código de 6 dígitos")}
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" disabled={busy}>{busy ? "Verificando…" : "Confirmar"}</button>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => { setSetup(null); setCode(""); setError(""); }}>Cancelar</button>
          </div>
        </form>
      </> : <>
        <p className="text-sm text-soft">Protege tu cuenta con un código temporal de tu teléfono, además de tu contraseña.</p>
        <form onSubmit={(e) => void act(e, async () => { setSetup(await call({ action: "start", password })); })} className="space-y-3">
          {passwordField}
          <button className="btn btn-primary" disabled={busy}>{busy ? "Preparando…" : "Activar"}</button>
        </form>
      </>}
    </section>
  );
}
