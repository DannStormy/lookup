import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /api/card stays crawlable: social crawlers obey robots.txt when fetching share images.
      disallow: ["/api/sky", "/api/push/", "/api/cron/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
