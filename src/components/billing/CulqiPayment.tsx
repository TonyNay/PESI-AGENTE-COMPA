"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { CulqiCheckoutData, PaymentResult } from "@/lib/billing/catalog";
import { PaymentApiError, paymentFetch } from "./api";
import { loadCulqiScript, type ThreeDS } from "./sdk";
import styles from "./billing.module.css";

export function CulqiPayment({ paymentId, checkout, onPaid, onBusy }: {
  paymentId: string; checkout: CulqiCheckoutData;
  onPaid: (result: PaymentResult) => Promise<void>;
  onBusy: (busy: boolean) => void;
}) {
  const [frame, setFrame] = useState<"loading" | "ready" | "error">("loading");
  const [frameError, setFrameError] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [checking, setChecking] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [retry, setRetry] = useState(0);
  const [display, setDisplay] = useState<"embedded" | "popup">("embedded");
  const id = `compa-culqi-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const box = useRef<HTMLDivElement>(null);
  const checkRef = useRef<(() => Promise<void>) | null>(null);
  const openRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let alive = true;
    let dispose = () => {};
    // El checkout no depende de 3DS para dibujarse. 3DS se carga al tokenizar una tarjeta.
    void loadCulqiScript("checkout").then(() => {
      if (!alive || !box.current || !window.CulqiCheckout) return;
      const target = box.current;
      target.replaceChildren();
      let done = false;
      let sending = false;
      let preparing = false;
      let authenticating = false;
      let checkingStatus = false;
      let token = "";
      let fingerprint = "";
      let threeDS: ThreeDS | undefined;
      let poll: ReturnType<typeof setInterval> | undefined;
      let authTimer: ReturnType<typeof setTimeout> | undefined;
      const frameListeners = new Map<HTMLIFrameElement, () => void>();
      const sdk = new window.CulqiCheckout(checkout.publicKey, {
        settings: { title: "Compa", currency: "PEN", amount: checkout.amount, order: checkout.orderId }, client: checkout.client,
        options: { lang: "es", modal: display === "popup", container: `#${id}`, installments: false,
          paymentMethods: checkout.paymentMethods, paymentMethodsSort: Object.keys(checkout.paymentMethods).filter((method) => checkout.paymentMethods[method]) },
        appearance: { theme: "default", menuType: "sliderTop", hiddenBanner: true,
          defaultStyle: { buttonBackground: "#0e8f7e", buttonTextColor: "#ffffff", menuColor: "#0e8f7e", linksColor: "#0e8f7e", priceColor: "#12203a" } },
      });
      const closeSDK = () => { try { sdk.close(); } catch { /* El proveedor puede haber cerrado ya su ventana. */ } };

      const rendered = () => { if (alive && !done) { clearTimeout(renderTimer); setFrame("ready"); setFrameError(""); } };
      const observeContent = () => {
        if (target.querySelector("form, input, [role='tab']")) rendered();
        for (const iframe of target.querySelectorAll("iframe")) {
          if (frameListeners.has(iframe)) continue;
          const loaded = () => rendered();
          frameListeners.set(iframe, loaded); iframe.addEventListener("load", loaded);
          // Solo es legible si el SDK usa srcdoc o un documento del mismo origen.
          try { if (iframe.contentDocument?.readyState === "complete" && iframe.contentDocument.body?.childElementCount) rendered(); } catch { /* El formulario puede estar en el origen de Culqi. */ }
        }
      };
      const observer = new MutationObserver(observeContent);
      observer.observe(target, { childList: true, subtree: true });
      const reportBusy = (value: boolean) => { if (alive) setProcessing(value); onBusy(value); };

      const paid = async (result: PaymentResult) => {
        if (!alive || done) return;
        done = true; clearInterval(poll); clearTimeout(authTimer); reportBusy(false); closeSDK(); await onPaid(result);
      };
      const check = async (manual = false) => {
        if (!alive || done || checkingStatus) return;
        checkingStatus = true; setChecking(true);
        try {
          const result = await paymentFetch<PaymentResult>(`/api/payments/${encodeURIComponent(paymentId)}`);
          if (!alive) return;
          if (result.paid) await paid(result);
          else if (["expired", "cancelled", "failed"].includes(result.payment.status)) {
            clearInterval(poll); clearTimeout(renderTimer); done = true; closeSDK();
            setFrame("error"); setFrameError("Esta orden ya no está disponible. Cierra la ventana y elige un plan para iniciar otra compra.");
          } else if (manual || result.payment.message) setMessage(result.payment.message ?? "El pago sigue pendiente de confirmación.");
        } catch (e) { if (alive) setError(e instanceof Error ? e.message : "No se pudo consultar el pago."); }
        finally { checkingStatus = false; if (alive) setChecking(false); }
      };
      const pending = () => {
        if (!alive) return;
        reportBusy(false); setMessage("Esperando la confirmación del pago. Tu plan se activará automáticamente.");
        if (!poll) poll = setInterval(() => {
          if (Date.now() > checkout.expiresAt + 60_000) { clearInterval(poll); return; }
          if (!document.hidden) void check();
        }, 5_000);
      };
      const cancelAuthentication = async () => {
        authenticating = false; clearTimeout(authTimer);
        try { await paymentFetch(`/api/payments/${paymentId}/cancel-authentication`, {}); } catch { /* Nunca se reintenta automáticamente un cargo. */ }
        if (alive) { reportBusy(false); setMessage("La autenticación no se completó. Puedes consultar el estado o probar nuevamente."); }
      };
      const sendCharge = async (authentication3DS?: Record<string, string>) => {
        if (!alive || done || sending) return;
        sending = true; reportBusy(true); setError(""); setMessage("Confirmando tu pago…");
        try {
          const result = await paymentFetch<PaymentResult>(`/api/payments/${paymentId}/charge`, { tokenId: token, deviceId: fingerprint, ...(authentication3DS ? { authentication3DS } : {}) });
          if (!alive) return;
          if (result.paid) await paid(result);
          else if (result.requires3DS && !authentication3DS && threeDS) {
            authenticating = true; setMessage("Completa la verificación en la ventana de tu banco.");
            threeDS.options = { showModal: true, showLoading: true, closeModalAction: () => { void cancelAuthentication(); } };
            threeDS.initAuthentication(token);
            authTimer = setTimeout(() => { if (authenticating) { threeDS?.reset(); void cancelAuthentication(); } }, 120_000);
          } else pending();
        } catch (e) {
          if (!alive) return;
          if (authenticating) await cancelAuthentication();
          reportBusy(false);
          if (!(e instanceof PaymentApiError) || e.uncertain || e.status >= 500 || e.status === 409) pending();
          else setMessage("Revisa los datos o selecciona otro medio de pago.");
          setError(e instanceof Error ? e.message : "No se pudo confirmar el pago.");
        } finally { sending = false; }
      };
      const listener = (event: MessageEvent) => {
        if (event.origin !== window.location.origin || !authenticating || !event.data || typeof event.data !== "object") return;
        if (event.data.parameters3DS) {
          authenticating = false; clearTimeout(authTimer); void sendCharge(event.data.parameters3DS as Record<string, string>);
        } else if (event.data.error) void cancelAuthentication();
      };
      sdk.culqi = () => {
        if (!alive || done || sending || preparing || authenticating) return;
        if (sdk.token?.id) {
          token = sdk.token.id; preparing = true; setError(""); setMessage("Verificando tu dispositivo…"); reportBusy(true);
          void (async () => {
            try {
              await loadCulqiScript("threeDS");
              if (!alive) return;
              threeDS = window.Culqi3DS;
              if (!threeDS) throw new Error("No se pudo cargar la verificación del banco.");
              threeDS.reset(); threeDS.publicKey = checkout.publicKey;
              threeDS.settings = { charge: { totalAmount: checkout.amount, currency: "PEN", returnUrl: window.location.href }, card: { email: checkout.client.email } };
              fingerprint = await threeDS.generateDevice();
              if (!fingerprint) throw new Error("No se pudo verificar el dispositivo. Vuelve a intentarlo.");
              await sendCharge();
            } catch (e) { if (alive) { reportBusy(false); setError(e instanceof Error ? e.message : "No se pudo verificar el dispositivo."); } }
            finally { preparing = false; }
          })();
        } else if (sdk.order) { pending(); void check(); }
        else setError(sdk.error?.user_message ?? "Revisa los datos de pago.");
      };
      window.addEventListener("message", listener);
      checkRef.current = () => check(true);
      openRef.current = () => {
        try { sdk.open(); }
        catch { setFrame("error"); setFrameError("No se pudo abrir la ventana de Culqi. Vuelve a intentarlo."); }
      };
      dispose = () => {
        clearInterval(poll); clearTimeout(authTimer); clearTimeout(renderTimer); observer.disconnect();
        frameListeners.forEach((callback, iframe) => iframe.removeEventListener("load", callback));
        window.removeEventListener("message", listener); checkRef.current = null; openRef.current = null;
        if (authenticating) void paymentFetch(`/api/payments/${paymentId}/cancel-authentication`, {}).catch(() => {});
        sdk.culqi = () => {}; closeSDK();
        try { threeDS?.reset(); } catch { /* El cierre no debe impedir volver a los planes. */ }
        target.replaceChildren(); onBusy(false);
      };
      const renderTimer = setTimeout(() => {
        if (!alive) return;
        setFrame("error"); setFrameError("El formulario de Culqi no terminó de cargar. Puedes reintentar o abrir su ventana de pago.");
      }, 20_000);
      sdk.open(); observeContent();
      if (display === "popup") rendered();
      void check();
    }).catch((e) => {
      if (!alive) return;
      dispose(); dispose = () => {}; setFrame("error"); setFrameError(e instanceof Error ? e.message : "No se pudo abrir Culqi.");
    });
    return () => { alive = false; dispose(); };
  }, [checkout, paymentId, id, retry, display, onPaid, onBusy]);

  function reload(mode: typeof display = display) { if (processing) return; setFrame("loading"); setFrameError(""); setError(""); setMessage(""); setDisplay(mode); setRetry((v) => v + 1); }

  return <div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {frame === "error" && <div className={styles.frameError} role="alert"><span className="text-xl" aria-hidden>↻</span><h3>No se pudo mostrar el formulario</h3><p>{frameError}</p><div className="flex flex-wrap justify-center gap-2"><button type="button" disabled={processing} className={styles.secondaryButton} onClick={() => reload("embedded")}>Volver a intentar</button><button type="button" disabled={processing} className={styles.secondaryButton} onClick={() => reload("popup")}>Abrir ventana de pago</button></div></div>}
    {display === "popup" && frame === "ready" && <div className={styles.frameError}><h3>Continúa en la ventana de Culqi</h3><p>Completa allí los datos del medio de pago que elegiste.</p><button type="button" disabled={processing} className={styles.secondaryButton} onClick={() => openRef.current?.()}>Abrir pago seguro</button></div>}
    <div className={styles.frameShell} hidden={frame === "error" || (display === "popup" && frame === "ready")} aria-busy={frame === "loading"}>
      <div ref={box} id={id} className={styles.culqiContainer} />
      {frame === "loading" && <div className={styles.loading} role="status"><span className={styles.spinner} /><div><strong>Conectando con Culqi</strong><br />Preparando tus medios de pago…</div></div>}
    </div>
    <div className={styles.statusLine}><p role="status">{message || "Pago protegido por Culqi"}</p><button type="button" disabled={checking} onClick={() => void checkRef.current?.()}>{checking ? "Consultando…" : "Consultar estado"}</button></div>
    {frame === "ready" && display === "embedded" && <details className={styles.frameTrouble}><summary>¿No aparece el formulario completo?</summary><p>Si tu navegador bloquea el formulario incrustado, puedes abrir la ventana de pago de Culqi con esta misma orden.</p><button type="button" disabled={processing} onClick={() => reload("popup")}>Abrir ventana de pago</button></details>}
    <p className={styles.secure}>Tus datos de tarjeta se ingresan directamente en Culqi.</p>
  </div>;
}
