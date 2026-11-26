import { PaymentError } from "./config";

export function assertPaymentOrigin(req: Request) {
  if (req.headers.get("sec-fetch-site") === "cross-site") throw new PaymentError("Origen no permitido.", 403);
  const origin = req.headers.get("origin");
  if (!origin) return;
  try {
    const allowed = new Set([new URL(req.url).origin]);
    if (process.env.COMPA_PUBLIC_URL) allowed.add(new URL(process.env.COMPA_PUBLIC_URL).origin);
    if (!allowed.has(new URL(origin).origin)) throw new Error();
  } catch { throw new PaymentError("Origen no permitido.", 403); }
}

/** El cuerpo de pagos es pequeño; limitar el stream antes de interpretarlo. */
export async function readPaymentBody(req: Request) {
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new PaymentError("Envía la solicitud en formato JSON.", 415);
  const max = 16 * 1024;
  if (Number(req.headers.get("content-length") ?? 0) > max) throw new PaymentError("La solicitud es demasiado grande.", 413);
  const reader = req.body?.getReader();
  if (!reader) throw new PaymentError("La solicitud está vacía.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) { await reader.cancel(); throw new PaymentError("La solicitud es demasiado grande.", 413); }
    chunks.push(value);
  }
  const data = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; }
  try {
    const body: unknown = JSON.parse(new TextDecoder().decode(data));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new PaymentError("La solicitud JSON no es válida."); }
}
