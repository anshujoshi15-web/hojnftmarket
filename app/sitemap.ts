import type { MetadataRoute } from "next";
import { publicPages, siteUrl } from "@/lib/aura-discovery";

export default function sitemap(): MetadataRoute.Sitemap {
  return publicPages.map(([path]) => ({ url: siteUrl(path) }));
}
