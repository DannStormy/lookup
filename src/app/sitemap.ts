import type { MetadataRoute } from "next";
import { CITIES } from "@/lib/cities";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/sky`, changeFrequency: "weekly", priority: 0.6 },
    ...CITIES.map((c) => ({
      url: `${SITE_URL}/sky/${c.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];
}
