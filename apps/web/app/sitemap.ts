import type { MetadataRoute } from "next";
import { indexable, pages, siteUrl } from "../lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return indexable ? Object.keys(pages).map((path) => ({ url: new URL(path, siteUrl).href })) : [];
}
