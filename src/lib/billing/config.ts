export class PaymentError extends Error {
  constructor(message: string, public status: number = 400, public uncertain = false) { super(message); }
}

/** Esta integración académica solo admite llaves test, incluso si Next corre en producción. */
export function billingConfiguration() {
  const publicKey = process.env.CULQI_PUBLIC_KEY?.trim() ?? "";
  const secretKey = process.env.CULQI_SECRET_KEY?.trim() ?? "";
  const live = publicKey.startsWith("pk_live_") || secretKey.startsWith("sk_live_");
  const enabled = !live && /^pk_test_[A-Za-z0-9]+$/.test(publicKey) && /^sk_test_[A-Za-z0-9]+$/.test(secretKey);
  return {
    publicKey, secretKey, enabled,
    simulatorEnabled: !live && process.env.COMPA_PAYMENT_SIMULATOR === "1",
    message: live ? "Esta versión académica solo admite llaves de prueba. Los cobros reales están deshabilitados."
      : enabled ? null : "Los pagos de Culqi necesitan sus dos llaves de prueba en el servidor.",
  };
}
