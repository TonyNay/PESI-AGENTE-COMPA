export class PaymentApiError extends Error {
  constructor(message: string, public status: number, public uncertain: boolean) { super(message); }
}

export async function paymentFetch<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin", cache: "no-store",
    ...(body === undefined ? {} : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => null) as (T & { error?: string; uncertain?: boolean }) | null;
  if (!response.ok || !data) throw new PaymentApiError(data?.error ?? "No se pudo confirmar la respuesta del servidor.", response.status, data?.uncertain ?? true);
  return data;
}
