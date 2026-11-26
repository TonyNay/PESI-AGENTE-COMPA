"use client";

import Link from "next/link";
import { useCallback, useRef, useState, type FormEvent } from "react";
import { BILLING_PLANS, BILLING_TERMS_VERSION, findBillingPlan, igvBreakdown, PAYMENT_STATE_LABEL, REFUND_MAX_ANALYSES, REFUND_WINDOW_DAYS, soles,
  type BillingOverview, type BillingPlanId, type CheckoutResult, type PaymentProvider, type PaymentResult, type PaymentSummary } from "@/lib/billing/catalog";
import { paymentFetch, PaymentApiError } from "./api";
import { CulqiPayment } from "./CulqiPayment";
import { BillingDialog } from "./BillingDialog";
import styles from "./billing.module.css";

const date = (value: number) => new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Lima" }).format(value);
const shortDate = (value: number) => new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeZone: "America/Lima" }).format(value);
const errorMessage = (e: unknown) => e instanceof Error ? e.message : "No se pudo completar la operación.";

function Icon({ kind, size = 18 }: { kind: "check" | "lock" | "spark" | "arrow" | "info" | "card" | "building"; size?: number }) {
  const paths = {
    check: "m5 12 4 4L19 6", lock: "M5 10h14v11H5zM8 10V7a4 4 0 0 1 8 0v3M12 14v3",
    spark: "m12 3 2.8 6.2L21 12l-6.2 2.8L12 21l-2.8-6.2L3 12l6.2-2.8z", arrow: "M4 12h15m-5-5 5 5-5 5",
    info: "M12 17v-5m0-4h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0", card: "M3 5h18v14H3zM3 10h18M7 15h3",
    building: "M4 21V6l8-3v18M12 10h8v11M8 8v1m0 3v1m0 3v1m8-3v1m0 3v1M2 21h20",
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={paths[kind]} /></svg>;
}

function State({ payment }: { payment: PaymentSummary }) {
  return <span className={styles.state} data-state={payment.status}>{PAYMENT_STATE_LABEL[payment.status]}</span>;
}
function download(payment: PaymentSummary, company: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ title: "Constancia académica · no es comprobante fiscal", company, ...payment, desglose: igvBreakdown(payment.amount) }, null, 2)], { type: "application/json" }));
  const a = document.createElement("a"); a.href = url; a.download = `compa-${payment.id}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function BillingClient({ initial, company, canBuy }: { initial: BillingOverview; company: string; canBuy: boolean }) {
  const [overview, setOverview] = useState(initial);
  const [provider, setProvider] = useState<PaymentProvider>("culqi");
  const [tab, setTab] = useState<"plans" | "history">("plans");
  const [overlay, setOverlay] = useState<"checkout" | "help" | "detail" | null>(null);
  const [selected, setSelected] = useState<BillingPlanId | null>(null);
  const [buyer, setBuyer] = useState(initial.buyer);
  const [invoice, setInvoice] = useState(initial.invoice);
  const [accepted, setAccepted] = useState(false);
  const [active, setActive] = useState<CheckoutResult | null>(null);
  const [detail, setDetail] = useState<PaymentResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [method, setMethod] = useState("Tarjeta");
  const [refundReason, setRefundReason] = useState("");
  const [refunding, setRefunding] = useState(false);
  const requestId = useRef<string | null>(null);
  const requestLock = useRef(false);
  const mode = provider === "culqi" ? "TEST" : "SIMULATED";
  const membership = overview.memberships.find((m) => m.mode === mode && m.active);
  const currentPlan = membership ? findBillingPlan(membership.planId) : undefined;
  const selectedPlan = selected ? findBillingPlan(selected) : undefined;
  const enabled = provider === "culqi" ? overview.enabled : overview.simulatorEnabled;

  const refresh = useCallback(async () => { setOverview(await paymentFetch<BillingOverview>("/api/payments")); }, []);
  const onPaid = useCallback(async (result: PaymentResult) => {
    setActive((p) => p?.payment.id === result.payment.id ? { ...p, payment: result.payment, checkout: null } : p);
    setDetail(result); setBusy(false);
    try { await refresh(); } catch { setError("Tu pago fue confirmado. Recarga la página para actualizar el resumen del plan."); }
  }, [refresh]);

  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || requestLock.current) return;
    requestLock.current = true; setBusy(true); setError("");
    requestId.current ??= crypto.randomUUID();
    try {
      const result = await paymentFetch<CheckoutResult>("/api/payments", { planId: selected, provider, buyer, invoice, acceptedTerms: accepted, legalVersion: BILLING_TERMS_VERSION, requestId: requestId.current });
      setActive(result); requestId.current = null;
      // El checkout permanece utilizable aunque falle la actualización del historial.
      await refresh().catch(() => {});
    } catch (e) { setError(errorMessage(e)); if (e instanceof PaymentApiError && !e.uncertain) requestId.current = null; }
    finally { requestLock.current = false; setBusy(false); }
  }

  async function inspect(payment: PaymentSummary, resume = false) {
    if (requestLock.current) return;
    requestLock.current = true; setBusy(true); setError("");
    try {
      if (resume) {
        const result = await paymentFetch<CheckoutResult>(`/api/payments/${payment.id}`, {});
        setProvider(payment.provider); setSelected(payment.planId); setActive(result); setDetail(null); setMethod("Tarjeta"); setOverlay("checkout");
      } else {
        const result = await paymentFetch<PaymentResult>(`/api/payments/${payment.id}`);
        setDetail(result); setOverlay("detail");
      }
      await refresh().catch(() => {});
    } catch (e) { setError(errorMessage(e)); }
    finally { requestLock.current = false; setBusy(false); }
  }

  async function simulate(outcome: "paid" | "pending" | "failed") {
    if (!active || requestLock.current) return;
    requestLock.current = true; setBusy(true); setError("");
    try {
      const result = await paymentFetch<PaymentResult>(`/api/payments/${active.payment.id}/simulate`, { outcome, method });
      setActive((p) => p ? { ...p, payment: result.payment } : p); setDetail(result);
      if (result.paid) await onPaid(result); else await refresh().catch(() => {});
    } catch (e) { setError(errorMessage(e)); }
    finally { requestLock.current = false; setBusy(false); }
  }

  async function requestRefund() {
    if (!detail || requestLock.current) return;
    requestLock.current = true; setBusy(true); setError("");
    try {
      const result = await paymentFetch<PaymentResult>(`/api/payments/${detail.payment.id}/refund`, { reason: refundReason });
      setDetail(result); setRefunding(false); setRefundReason("");
      await refresh().catch(() => {});
    } catch (e) { setError(errorMessage(e)); }
    finally { requestLock.current = false; setBusy(false); }
  }

  function choose(id: BillingPlanId) {
    setSelected(id); setActive(null); setDetail(null); setAccepted(false); setError(""); setMethod("Tarjeta"); requestId.current = null;
    setOverlay("checkout");
  }
  function close() { if (!busy && !requestLock.current) { setOverlay(null); setActive(null); setSelected(null); setError(""); setRefunding(false); setRefundReason(""); } }
  const renewal = overview.renewal;

  return <div className={styles.page}>
    <button type="button" className={styles.helpButton} aria-label="Ayuda e información de pagos" title="Ayuda e información de pagos" disabled={busy} onClick={() => setOverlay("help")}><Icon kind="info" size={17} /> Ayuda</button>
    <header className={styles.hero}>
      <p className={styles.eyebrow}>Planes de Compa</p>
      <h1 className={styles.title}>Más claridad para<br />tu próxima decisión.</h1>
      <p className={styles.subtitle}>Encuentra el plan que acompaña a tu negocio.<br />Compara tu mercado y convierte los datos en una mejor estrategia.</p>
      <p className={styles.termsLine}><Icon kind="check" size={14} /> 31 días de acceso <span aria-hidden>·</span> Pago único <span aria-hidden>·</span> Sin renovación automática <span aria-hidden>·</span> Garantía de {REFUND_WINDOW_DAYS} días</p>
    </header>

    <div className={styles.tabs} role="tablist" aria-label="Planes y facturación" onKeyDown={(event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === "Home" ? "plans" : event.key === "End" ? "history" : tab === "plans" ? "history" : "plans";
      setTab(next); document.getElementById(`${next}-tab`)?.focus();
    }}>
      <button type="button" id="plans-tab" role="tab" tabIndex={tab === "plans" ? 0 : -1} aria-selected={tab === "plans"} aria-controls="plans-panel" className={styles.tab} onClick={() => setTab("plans")}>Planes y beneficios</button>
      <button type="button" id="history-tab" role="tab" tabIndex={tab === "history" ? 0 : -1} aria-selected={tab === "history"} aria-controls="history-panel" className={styles.tab} onClick={() => setTab("history")}>Historial de pagos{overview.payments.length > 0 && <span className={styles.count}>{overview.payments.length}</span>}</button>
    </div>
    {error && !overlay && <p className={styles.error} role="alert">{error}</p>}
    {renewal && <p className={styles.notice} role="status">{renewal.state === "expiring"
      ? <>Tu plan {renewal.planName} vence {renewal.daysLeft <= 1 ? "en menos de un día" : `en ${renewal.daysLeft} días`} ({shortDate(renewal.activeUntil)}). Renuévalo para no perder el acceso; los días restantes se suman.</>
      : <>Tu plan {renewal.planName} venció el {shortDate(renewal.activeUntil)}. Ahora rige la prueba gratuita.</>}
      {canBuy && <> <button type="button" className="underline" disabled={busy} onClick={() => { setProvider(renewal.mode === "SIMULATED" ? "demo" : "culqi"); choose(renewal.planId); }}>Renovar {renewal.planName}</button></>}</p>}
    {provider === "demo" && <p className={styles.notice}>Simulador local activo. Los resultados se guardan como simulaciones. <button type="button" className="underline" onClick={() => setOverlay("help")}>Cambiar entorno</button></p>}
    {!canBuy && <p className={styles.notice}>Puedes revisar los planes y el historial. Un administrador de tu empresa debe realizar la compra.</p>}

    {tab === "plans" ? <section role="tabpanel" id="plans-panel" aria-labelledby="plans-tab">
      {!enabled && <p className={styles.notice}>{provider === "culqi" ? overview.configurationMessage : "El simulador está deshabilitado en esta instalación."} <button type="button" className="underline" onClick={() => setOverlay("help")}>Más información</button></p>}
      <div className={styles.planGrid}>
        {BILLING_PLANS.map((plan) => <article key={plan.id} className={`${styles.planCard} ${"highlighted" in plan ? styles.featured : ""}`}>
          <div className={styles.planTop}><div className={styles.planIcon}><Icon kind={plan.id === "empresa" ? "building" : plan.id === "pro" ? "spark" : "card"} size={21} /></div>{"highlighted" in plan && <span className={styles.planBadge}>La opción más completa para empezar</span>}</div>
          <h2 className={styles.planName}>{plan.name}</h2><p className={styles.planDescription}>{plan.description}</p>
          <p className={styles.price}><span className={styles.currency}>S/</span>{(plan.amount / 100).toFixed(2)}</p><p className={styles.pricePeriod}>por 31 días · un solo pago</p><p className={styles.pricePeriod}>Incluye IGV: {soles(igvBreakdown(plan.amount).igv)}</p>
          <button type="button" disabled={busy || !enabled || !canBuy} className={styles.choose} onClick={() => choose(plan.id)}>{currentPlan?.id === plan.id ? "Renovar mi plan" : `Elegir ${plan.name}`}<Icon kind="arrow" size={16} /></button>
          <p className={styles.featureLabel}>Lo que incluye tu plan</p>
          <ul className={styles.features}>{plan.features.map((feature) => <li key={feature} className={styles.feature}><Icon kind="check" size={15} /><span>{feature}</span></li>)}</ul>
        </article>)}
      </div>
      <div className={styles.supported}><span className="inline-flex items-center gap-1.5"><Icon kind="lock" size={13} /> Pago seguro con Culqi</span><div className={styles.paymentBrands}><span>VISA</span><span>Mastercard</span><span>Yape</span><span>QR</span></div></div>
      <section className={styles.account} aria-label="Tu plan y uso de la cuenta">
        <div className={styles.accountName}><p className={styles.eyebrow}>Tu espacio en Compa</p><h2>{currentPlan?.name ?? overview.plan.name}</h2><p>{membership ? `Vigente hasta el ${shortDate(membership.activeUntil)}` : company}</p></div>
        <dl className={styles.stats}>{([
          ["Análisis de precios", overview.usage.priceAnalyses, overview.plan.priceAnalyses], ["Análisis estratégicos", overview.usage.strategicAnalyses, overview.plan.strategicAnalyses], ["Productos en catálogo", overview.usage.products, overview.plan.products],
        ] as const).map(([label, value, limit]) => <div key={label} className={styles.stat}><dt>{label}</dt><dd>{value}<span>{limit ? ` / ${limit}` : label === "Productos en catálogo" ? " registrados" : " este mes"}</span></dd></div>)}</dl>
      </section>
    </section> : <section role="tabpanel" id="history-panel" aria-labelledby="history-tab" className={styles.history}>
      <div className={styles.historyHeading}><h2>Tus pagos, en un solo lugar</h2><p>Últimas 30 compras · {company}</p></div>
      {overview.payments.length === 0 ? <div className={styles.empty}><p>Aún no tienes pagos registrados.</p><p className="mt-2 text-xs">Tus compras y constancias aparecerán aquí.</p></div> : <div className={styles.tableWrap}><table><thead><tr><th>Plan</th><th>Fecha</th><th>Importe</th><th>Estado</th><th>Detalle</th></tr></thead><tbody>
        {overview.payments.map((p) => <tr key={p.id}><td><strong className="font-medium">{p.planName}</strong><small>{p.method ?? "Pago por confirmar"}{p.mode === "SIMULATED" ? " · Simulado" : ""}</small></td><td>{shortDate(p.createdAt)}</td><td>{soles(p.amount)}</td><td><State payment={p} /></td><td><div className="flex gap-4"><button disabled={busy} type="button" className={styles.rowAction} onClick={() => void inspect(p)}>{busy ? "Consultando…" : "Ver detalle"}</button>{p.status === "pending" && canBuy && <button disabled={busy} type="button" className={styles.rowAction} onClick={() => void inspect(p, true)}>Continuar pago</button>}</div></td></tr>)}
      </tbody></table></div>}
    </section>}
    <p className={styles.footerNote}>El plan se activa al confirmar el pago. <Link href="/billing/conditions">Términos y condiciones</Link></p>

    {overlay === "checkout" && selectedPlan && <BillingDialog title={active?.payment.status === "paid" ? "Tu compra está lista" : "Completa tu compra"} onClose={close} busy={busy} wide>
      <div className={styles.checkoutGrid}>
        <aside className={styles.orderSummary}>
          <span className={styles.eyebrow}>Tu pedido</span><h2>Plan {selectedPlan.name}</h2><p>{company}<br />31 días de acceso</p>
          <ul className={styles.orderFeatures}>{selectedPlan.features.map((f) => <li key={f} className={styles.feature}><Icon kind="check" size={14} /><span>{f}</span></li>)}</ul>
          <dl className="mt-4 space-y-1 text-sm">{(() => { const b = igvBreakdown(active?.payment.amount ?? selectedPlan.amount); return <><div className="flex justify-between"><dt>Valor de venta</dt><dd>{soles(b.base)}</dd></div><div className="flex justify-between"><dt>IGV (18 %)</dt><dd>{soles(b.igv)}</dd></div></>; })()}</dl>
          <div className={styles.total}><span>Total a pagar</span><strong>{soles(active?.payment.amount ?? selectedPlan.amount)}</strong></div>
          <div className={styles.orderFootnote}>Pago único en soles.<br />Sin renovación ni cargos automáticos.</div>
        </aside>
        <div className={styles.formPanel}>
          {active?.payment.status !== "paid" && <div className={styles.steps} aria-label="Paso de la compra"><span className={`${styles.step} ${!active ? styles.stepActive : ""}`}><span>{active ? "✓" : "1"}</span>Tus datos</span><span className={styles.stepLine} /><span className={`${styles.step} ${active ? styles.stepActive : ""}`}><span>2</span>Pago</span></div>}
          {error && <p className={styles.error} role="alert">{error}</p>}
          {!active ? <>
            <h2 className={styles.formTitle}>¿A nombre de quién va la compra?</h2><p className={styles.formSubtitle}>Revisa tus datos para continuar al pago.</p>
            <form onSubmit={(e) => void start(e)}>
              <div className={styles.fields}>{([
                ["firstName", "Nombres", "text", "given-name"], ["lastName", "Apellidos", "text", "family-name"], ["email", "Correo electrónico", "email", "email"], ["phone", "Celular", "tel", "tel"],
              ] as const).map(([key, label, type, autoComplete]) => <label key={key} className={styles.field}>{label}<input required disabled={busy} type={type} autoComplete={autoComplete} maxLength={key === "phone" ? 16 : 50} minLength={key === "phone" ? 9 : 2} placeholder={key === "phone" ? "9XX XXX XXX" : undefined} value={buyer[key]} onChange={(e) => { setBuyer((b) => ({ ...b, [key]: e.target.value })); requestId.current = null; }} /></label>)}</div>
              <div className={`${styles.fields} mt-4`}>
                <label className={styles.field}>Comprobante<select disabled={busy} value={invoice.type} onChange={(e) => { const type = e.target.value as typeof invoice.type; setInvoice((i) => ({ ...i, type, documentNumber: type === "factura" ? initial.invoice.documentNumber : "" })); requestId.current = null; }}><option value="boleta">Boleta de venta</option><option value="factura">Factura</option></select></label>
                <label className={styles.field}>{invoice.type === "factura" ? "RUC" : "DNI (opcional)"}<input disabled={busy} required={invoice.type === "factura"} inputMode="numeric" maxLength={invoice.type === "factura" ? 11 : 8} pattern={invoice.type === "factura" ? "\\d{11}" : "\\d{8}"} value={invoice.documentNumber} onChange={(e) => { setInvoice((i) => ({ ...i, documentNumber: e.target.value })); requestId.current = null; }} /></label>
                {invoice.type === "factura" && <label className={styles.field}>Razón social<input required disabled={busy} minLength={2} maxLength={120} value={invoice.legalName} onChange={(e) => { setInvoice((i) => ({ ...i, legalName: e.target.value })); requestId.current = null; }} /></label>}
              </div>
              <label className={styles.consent}><input type="checkbox" required disabled={busy} checked={accepted} onChange={(e) => setAccepted(e.target.checked)} /><span>Acepto los <Link href="/billing/conditions" target="_blank" rel="noreferrer">términos y condiciones</Link> de esta compra.</span></label>
              <button type="submit" disabled={busy || !enabled || !canBuy} className={styles.primaryButton}>{busy ? <><span className={styles.spinner} />Preparando tu pago…</> : provider === "culqi" ? <>Continuar al pago<Icon kind="arrow" size={16} /></> : "Crear orden simulada"}</button>
            </form><p className={styles.secure}><Icon kind="lock" size={12} /> Tus datos de pago se procesan de forma segura en Culqi</p>
          </> : active.payment.status === "paid" ? <div className={styles.success} role="status"><span className={styles.successMark}><Icon kind="check" size={30} /></span><h3>Tu plan {active.payment.planName} está activo.</h3><p>Ya puedes consultar la vigencia y los detalles<br />de tu compra en tu cuenta.</p><p className="mt-3">{active.payment.mode === "TEST" ? "Pago confirmado en el entorno de prueba de Culqi." : "Aprobación registrada en el simulador local."}</p><button type="button" className={styles.secondaryButton} onClick={() => download(active.payment, company)}>Descargar constancia</button><button type="button" className={styles.primaryButton} onClick={close}>Volver a mis planes</button></div>
          : active.payment.provider === "culqi" && active.checkout ? <><h2 className={styles.formTitle}>Elige cómo pagar</h2><p className={styles.formSubtitle}>Tarjeta, Yape y otros medios disponibles para tu compra.</p><CulqiPayment key={active.payment.id} paymentId={active.payment.id} checkout={active.checkout} onPaid={onPaid} onBusy={setBusy} /></>
          : active.payment.provider === "demo" && active.payment.status === "pending" ? <section className={styles.simulator}><h3>Simulador local</h3><p>Selecciona un resultado para la demostración. Esta orden no contacta a Culqi ni a un banco.</p>
            <label className={styles.field}>Medio de pago<select value={method} disabled={busy} onChange={(e) => setMethod(e.target.value)}>{["Tarjeta", "Yape", "QR", "Banca móvil", "Agentes", ...(active.payment.amount >= 10000 ? ["Cuotéalo"] : [])].map((m) => <option key={m}>{m}</option>)}</select></label>
            {method === "QR" && <p>El QR se representa únicamente como una orden simulada; no genera un código cobrable.</p>}
            <div className={styles.simulatorActions}><button type="button" disabled={busy} className={styles.primaryButton} onClick={() => void simulate("paid")}>Aprobar</button><button type="button" disabled={busy} className={styles.secondaryButton} onClick={() => void simulate("pending")}>Pendiente</button><button type="button" disabled={busy} className={styles.secondaryButton} onClick={() => void simulate("failed")}>Rechazar</button></div>{active.payment.message && <p role="status">{active.payment.message}</p>}
          </section> : <div className={styles.empty}><State payment={active.payment} /><p className="mt-4">Esta orden ya no está disponible.<br />Puedes elegir un plan e iniciar otra compra.</p><button type="button" className={`${styles.secondaryButton} mt-5`} onClick={close}>Volver a los planes</button></div>}
          {active && <p className={styles.checkoutMeta}>Referencia de compra: {active.payment.id}</p>}
        </div>
      </div>
    </BillingDialog>}

    {overlay === "detail" && detail && <BillingDialog title="Detalle del pago" onClose={close} busy={busy}><div className={styles.detailBody}>
      <div className="flex items-center justify-between gap-4"><h2>Plan {detail.payment.planName}</h2><State payment={detail.payment} /></div>
      <dl className={styles.detailList}>{[["Importe", soles(detail.payment.amount)], ["Fecha", date(detail.payment.createdAt)], ["Medio de pago", detail.payment.method ?? "Pendiente"], ["Entorno", detail.payment.mode === "TEST" ? "Pruebas de Culqi" : "Simulador local"], ["Referencia", detail.payment.id], ...(detail.payment.transactionId ? [["Transacción", detail.payment.transactionId]] : [])].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      {detail.payment.message && <p className="text-xs leading-relaxed text-soft">{detail.payment.message}</p>}
      {detail.events && detail.events.length > 0 && <ol className={styles.events}>{detail.events.map((e) => <li key={e.id}>{e.message}<time>{date(e.createdAt)}</time></li>)}</ol>}
      {(detail.payment.status === "paid" || detail.payment.status === "refunded") && (detail.payment.receipt ? <Link className={styles.primaryButton} href={`/billing/receipt/${detail.payment.id}`}>Ver comprobante {detail.payment.receipt.number}{detail.payment.creditNote ? ` y nota de crédito ${detail.payment.creditNote.number}` : ""}</Link> : <button type="button" className={styles.primaryButton} onClick={() => download(detail.payment, company)}>Descargar constancia</button>)}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {detail.payment.refundable && canBuy && (!refunding
        ? <button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => setRefunding(true)}>Solicitar reembolso</button>
        : <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); void requestRefund(); }}>
          <p className="text-xs leading-relaxed text-soft">Garantía de {REFUND_WINDOW_DAYS} días: devolvemos el total si usaste hasta {REFUND_MAX_ANALYSES} análisis desde la compra. Se descuentan los 31 días del plan y se emite una nota de crédito que anula el comprobante.</p>
          <label className={styles.field}>Motivo<textarea required minLength={5} maxLength={300} rows={3} disabled={busy} value={refundReason} onChange={(e) => setRefundReason(e.target.value)} /></label>
          <div className="flex flex-wrap gap-2"><button type="submit" className={styles.primaryButton} disabled={busy}>{busy ? "Procesando…" : `Confirmar reembolso de ${soles(detail.payment.amount)}`}</button><button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => { setRefunding(false); setRefundReason(""); }}>Cancelar</button></div>
        </form>)}
    </div></BillingDialog>}

    {overlay === "help" && <BillingDialog title="Ayuda de pagos" onClose={close}><div className={styles.helpBody}>
      <h2>Sobre este entorno</h2><p>Compa está configurado para una demostración académica con Culqi TEST. No se realizan cobros reales. Cada plan limita los análisis del mes y los productos del catálogo; sin un plan activo rige la prueba gratuita.</p>
      <h3>Entorno de la compra</h3><div className={styles.environmentOptions}>
        <button type="button" aria-pressed={provider === "culqi"} onClick={() => { setProvider("culqi"); setError(""); }}>Culqi · modo de prueba</button>
        <button type="button" aria-pressed={provider === "demo"} disabled={!overview.simulatorEnabled} onClick={() => { setProvider("demo"); setError(""); }}>Simulador local</button>
      </div><p>El simulador permite demostrar aprobaciones y rechazos sin conexión al proveedor. Sus compras y su plan activo se guardan por separado y se identifican como simulaciones.</p>
      {overview.configurationMessage && <p>{overview.configurationMessage}</p>}
      <h3>Datos para probar el formulario de Culqi</h3><div className={styles.testCards}><table><thead><tr><th>Caso</th><th>Número</th><th>Vence</th><th>CVV / código</th></tr></thead><tbody>
        {[["Visa débito", "4111 1111 1111 1111", "09/30", "123"], ["Visa crédito", "4111 1111 1010 1113", "09/30", "123"], ["Mastercard", "5111 1111 1111 1118", "12/30", "039"], ["Sin fondos", "4000 0400 0000 0008", "03/30", "295"], ["Yape", "900000001", "—", "123456"]].map((r) => <tr key={r[0]}>{r.map((v, i) => <td key={i}>{v}</td>)}</tr>)}
      </tbody></table></div>
      <p>Reto 3DS: comprador <code>review@culqi.com</code>, Visa <code>4456530000001096</code>, vencimiento <code>07/30</code>, CVV <code>111</code>. Cambiar el correo del comprador no cambia tu acceso a Compa.</p>
      <h3>QR y otros medios</h3><p>Generar un QR o código deja la compra pendiente. El plan se activa cuando nuestro servidor verifica el pago con Culqi. La disponibilidad de métodos depende de la cuenta del proveedor; Cuotéalo se ofrece desde S/ 100, en el plan Empresa.</p>
      <p>Para exponer la aprobación de QR sin depender del sandbox, elige el simulador local. La confirmación de una simulación no modifica compras de Culqi.</p>
      <p><a href="https://docs.culqi.com/es/documentacion/pagos-online/tarjetas-de-prueba/" target="_blank" rel="noreferrer" className="text-brand underline">Datos oficiales de Culqi</a> · <Link className="text-brand underline" href="/billing/conditions">Términos y condiciones</Link></p>
      <button type="button" className={`${styles.primaryButton} mt-6`} onClick={close}>Entendido</button>
    </div></BillingDialog>}
  </div>;
}
