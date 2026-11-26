import type { MetadataRoute } from "next";
import { PUBLIC_ROUTES, siteUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return PUBLIC_ROUTES.map((path) => ({
    url: new URL(path, base).toString(),
    changeFrequency: path === "/" || path === "/ejemplo" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : path === "/ejemplo" ? 0.8 : 0.4,
  }));
}
