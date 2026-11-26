import type { Metadata } from "next";
import "./globals.css";
import { siteUrl } from "@/lib/seo";

const description = "Compa compara tus precios con los de tu competencia en tiendas y marketplaces del Perú y te entrega en dos minutos un reporte con FODA y precio sugerido. Para mipymes.";

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: { default: "Compa — Monitoreo de precios de la competencia para mipymes", template: "%s" },
  description,
  keywords: ["monitoreo de precios", "precios de la competencia", "inteligencia competitiva", "mipymes Perú", "análisis FODA", "precio sugerido", "comparador de precios"],
  applicationName: "Compa",
  alternates: { canonical: "/" },
  openGraph: { type: "website", locale: "es_PE", siteName: "Compa", title: "Compa — Sabe cuánto cobra tu competencia", description, url: "/" },
  twitter: { card: "summary", title: "Compa — Sabe cuánto cobra tu competencia", description },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
