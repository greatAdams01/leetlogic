import type { MetadataRoute } from "next";
import { indexable, siteUrl } from "../lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: indexable ? { userAgent: "*", allow: "/" } : { userAgent: "*", disallow: "/" },
    ...(indexable ? { sitemap: new URL("/sitemap.xml", siteUrl).href } : {}),
  };
}
