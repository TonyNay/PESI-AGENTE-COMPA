/**
 * Datos del operador de la plataforma (Compa como proveedor) y del personal que la administra.
 * Las empresas cliente tienen su propio rol "admin"; el administrador de la plataforma es distinto:
 * atiende el Libro de Reclamaciones y ve las métricas del negocio.
 */

/** Correos del personal de Compa (COMPA_PLATFORM_ADMINS, separados por coma). */
export function platformAdmins(): string[] {
  return (process.env.COMPA_PLATFORM_ADMINS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export const isPlatformAdmin = (email: string | null | undefined) => !!email && platformAdmins().includes(email.trim().toLowerCase());

/** Identificación del proveedor que exige la Hoja de Reclamación (art. 5 del D. S. 011-2011-PCM). */
export function providerInfo() {
  return {
    name: process.env.COMPA_PROVIDER_NAME?.trim() || "Compa (proyecto académico, empresa por constituir)",
    ruc: process.env.COMPA_PROVIDER_RUC?.trim() || "Pendiente de inscripción",
    address: process.env.COMPA_PROVIDER_ADDRESS?.trim() || "Huaraz, Áncash, Perú",
    email: process.env.COMPA_PROVIDER_EMAIL?.trim() || "reclamos@compa.pe",
  };
}

/** IP del cliente. X-Real-Ip la fija el proxy; el primer valor de X-Forwarded-For lo puede falsificar el cliente. */
export function clientIp(req: Request): string {
  return req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "local";
}
