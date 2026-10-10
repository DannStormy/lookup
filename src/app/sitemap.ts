import type { MetadataRoute } from "next";
import { showersByNextPeak } from "@/lib/astro/shower-forecast";
import { CITIES } from "@/lib/cities";
import { SITE_URL } from "@/lib/site";

export const revalidate = 86400;

const CITY_PAGES_WITHIN_DAYS = 75;

export default function sitemap(): MetadataRoute.Sitemap {
  const showers = showersByNextPeak();
  const soon = showers.filter(
    ({ peak }) => peak.getTime() - Date.now() < CITY_PAGES_WITHIN_DAYS * 86400000,
  );

  return [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/sky`, changeFrequency: "weekly", priority: 0.6 },
    ...CITIES.map((c) => ({
      url: `${SITE_URL}/sky/${c.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    { url: `${SITE_URL}/meteor-showers`, changeFrequency: "weekly", priority: 0.6 },
    ...showers.map(({ shower }) => ({
      url: `${SITE_URL}/meteor-showers/${shower.key}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    // only showers people are searching for now; the rest join as their peak nears
    ...soon.flatMap(({ shower }) =>
      CITIES.map((c) => ({
        url: `${SITE_URL}/meteor-showers/${shower.key}/${c.slug}`,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
    ),
  ];
}
