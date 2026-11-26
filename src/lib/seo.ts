/** Dirección pública del sitio para enlaces canónicos, sitemap y Open Graph. */
export function siteUrl(): URL {
  try { return new URL(process.env.COMPA_PUBLIC_URL || "http://localhost:3000"); }
  catch { return new URL("http://localhost:3000"); }
}

/** Rutas públicas que se pueden indexar. Todo lo demás requiere sesión. */
export const PUBLIC_ROUTES = ["/", "/ejemplo", "/libro-reclamaciones", "/privacidad", "/terminos"] as const;
export const PRIVATE_PREFIXES = ["/api/", "/dashboard", "/products", "/analyses", "/strategy", "/account", "/billing", "/admin", "/login", "/register"];
