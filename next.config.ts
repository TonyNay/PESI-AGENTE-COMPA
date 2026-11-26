import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["node:sqlite", "bcryptjs"],
  turbopack: {
    root: process.cwd(),
    rules: {
      // Aplicar Tailwind al punto de entrada global. Reescribir *.module.css
      // como *.css impide conservar los estilos y las clases de facturación.
      "globals.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
