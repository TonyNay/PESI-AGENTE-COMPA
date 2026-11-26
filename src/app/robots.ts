import type { MetadataRoute } from "next";
import { PRIVATE_PREFIXES, siteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: PRIVATE_PREFIXES }],
    sitemap: new URL("/sitemap.xml", base).toString(),
    host: base.origin,
  };
}
