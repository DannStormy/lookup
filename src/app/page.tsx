import type { Metadata } from "next";
import SkyApp from "@/components/SkyApp";

type SearchParams = Promise<{ [k: string]: string | string[] | undefined }>;

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

// A shared link (…/?lat=&lon=&name=Lagos) unfurls with that place's sky card.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const sp = await searchParams;
  const lat = one(sp.lat);
  const lon = one(sp.lon);
  const name = one(sp.name);

  if (lat && lon && isFinite(Number(lat)) && isFinite(Number(lon))) {
    const q = new URLSearchParams({ lat, lon, ...(name ? { name } : {}) });
    const card = `/api/card?${q.toString()}`;
    const title = name ? `The sky above ${name} tonight` : "The sky above you tonight";
    return {
      title,
      openGraph: { title, images: [{ url: card, width: 1200, height: 630 }] },
      twitter: { card: "summary_large_image", title, images: [card] },
    };
  }
  return {};
}

export default function Home() {
  return <SkyApp />;
}
