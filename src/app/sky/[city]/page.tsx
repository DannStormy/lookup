import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CitySky from "@/components/CitySky";
import Starfield from "@/components/Starfield";
import { computeSky } from "@/lib/astro/sky";
import { appHref, getCity, nearbyCities } from "@/lib/cities";
import { SITE_URL } from "@/lib/site";

export const revalidate = 1800;
export const maxDuration = 30;

// Rendered on first request and cached, so the build never computes 140 skies.
export function generateStaticParams() {
  return [];
}

type Params = Promise<{ city: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const city = getCity((await params).city);
  if (!city) return {};

  const title = `${city.name} night sky tonight: what to see and when | Look Up`;
  const description = `Space station passes, visible planets, the moon and meteor showers above ${city.name} tonight, with exact local times. Recalculated through the day from live data.`;
  const card = `/api/card?${new URLSearchParams({
    lat: String(city.lat),
    lon: String(city.lon),
    name: city.name,
  })}`;

  return {
    title,
    description,
    alternates: { canonical: `/sky/${city.slug}` },
    openGraph: {
      title,
      description,
      url: `/sky/${city.slug}`,
      images: [{ url: card, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title, description, images: [card] },
  };
}

export default async function CityPage({ params }: { params: Params }) {
  const city = getCity((await params).city);
  if (!city) notFound();

  const report = await computeSky({ lat: city.lat, lon: city.lon, elevation: 0, label: city.name });
  const nearby = nearbyCities(city);

  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Look Up", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Cities", item: `${SITE_URL}/sky` },
      { "@type": "ListItem", position: 3, name: city.name, item: `${SITE_URL}/sky/${city.slug}` },
    ],
  };

  return (
    <main className="night min-h-[100dvh]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs).replace(/</g, "\\u003c") }}
      />
      <Starfield />
      <div className="relative z-10 mx-auto max-w-[680px] px-6 pb-16">
        <header className="flex items-center justify-between py-6">
          <Link href="/" className="kicker">
            Look Up
          </Link>
          <Link href="/sky" className="text-[13px] text-ink-dim transition hover:text-ink-soft">
            All cities
          </Link>
        </header>

        <p className="kicker mb-6 mt-4">
          {city.name}, {city.country}
        </p>
        <h1 className="font-display text-[2.6rem] leading-[1.04] tracking-[-0.02em] text-ink sm:text-6xl">
          The sky above {city.name} tonight
        </h1>

        <CitySky city={city} initial={report} />

        <section className="mt-12">
          <Link
            href={appHref(city)}
            className="cta inline-block rounded-full px-6 py-3.5 text-[15px] font-medium"
          >
            Open the live sky for {city.name}
          </Link>
          <p className="mt-3 max-w-md text-[13px] leading-relaxed text-ink-dim">
            Live countdowns, a compass showing where to point, and an alert a few
            minutes before the space station passes over. Free, no signup.
          </p>
        </section>

        <section className="mt-14">
          <h2 className="kicker mb-4">Nearby skies</h2>
          <ul className="flex flex-wrap gap-2">
            {nearby.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/sky/${c.slug}`}
                  className="inline-block rounded-full border border-[var(--line)] px-3.5 py-1.5 text-[13px] text-ink-soft transition hover:border-[rgba(244,217,160,0.4)] hover:text-ink"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <footer className="mt-14 border-t border-[var(--line)] pt-6 text-xs leading-relaxed text-ink-dim">
          <p>
            Worked out for the centre of {city.name} from live satellite tracking,
            NOAA space-weather data, and where the sun, moon and planets actually
            are. Not somewhere in {city.name}?{" "}
            <Link href="/" className="underline underline-offset-4 hover:text-ink-soft">
              Use your own location
            </Link>
            .
          </p>
        </footer>
      </div>
    </main>
  );
}
