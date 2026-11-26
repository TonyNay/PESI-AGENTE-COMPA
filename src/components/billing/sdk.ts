export interface CheckoutSDK {
  token?: { id: string };
  order?: unknown;
  error?: { user_message?: string };
  culqi: () => void;
  open(): void;
  close(): void;
}
export interface ThreeDS {
  publicKey: string;
  settings: { charge: { totalAmount: number; currency: string; returnUrl: string }; card: { email: string } };
  options: { showModal: boolean; showLoading: boolean; closeModalAction: () => void };
  generateDevice(): Promise<string>;
  initAuthentication(token: string): void;
  reset(): void;
}
declare global {
  interface Window {
    CulqiCheckout?: new (publicKey: string, config: Record<string, unknown>) => CheckoutSDK;
    Culqi3DS?: ThreeDS;
  }
}

const scripts = {
  checkout: { id: "compa-culqi-sdk", src: "https://js.culqi.com/checkout-js", label: "el formulario de pago" },
  threeDS: { id: "compa-culqi-3ds", src: "https://3ds.culqi.com", label: "la autenticación del banco" },
} as const;
type ScriptName = keyof typeof scripts;
const pending = new Map<ScriptName, Promise<void>>();

/** SDK compartido entre aperturas. Los fallos se eliminan para que reintentar vuelva a descargar. */
export function loadCulqiScript(name: ScriptName, timeoutMs = 18_000): Promise<void> {
  const available = () => name === "checkout" ? typeof window.CulqiCheckout === "function" : Boolean(window.Culqi3DS);
  if (available()) return Promise.resolve();
  const previous = pending.get(name);
  if (previous) return previous;
  const config = scripts[name];
  const promise = new Promise<void>((resolve, reject) => {
    // Una carga que no publicó su global no es reutilizable.
    document.getElementById(config.id)?.remove();
    const script = document.createElement("script");
    script.id = config.id; script.src = config.src; script.async = true;
    const finish = (error?: string) => {
      clearTimeout(timer); script.onload = null; script.onerror = null;
      if (error) { script.remove(); pending.delete(name); reject(new Error(error)); }
      else resolve();
    };
    const timer = setTimeout(() => finish(`Culqi está tardando en cargar ${config.label}. Revisa tu conexión e inténtalo nuevamente.`), timeoutMs);
    script.onload = () => finish(available() ? undefined : `Culqi no pudo iniciar ${config.label}. Vuelve a intentarlo.`);
    script.onerror = () => finish(`No se pudo conectar con Culqi para cargar ${config.label}.`);
    document.head.appendChild(script);
  });
  pending.set(name, promise);
  return promise;
}
