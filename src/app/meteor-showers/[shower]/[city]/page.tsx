import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChipLink, ChipList } from "@/components/CityLinks";
import PageShell, { PageTitle } from "@/components/PageShell";
import { lookPhrase } from "@/lib/astro/core";
import { getShower, nextPeakNoon, showerForecast } from "@/lib/astro/shower-forecast";
import { getCity, nearbyCities } from "@/lib/cities";
import { timeIn } from "@/lib/format";
import {
  aboutLine,
  bestTime,
  moonLine,
  peakNight,
  radiantLine,
  singular,
  summaryLine,
} from "@/lib/shower-copy";

export const revalidate = 86400;

export function generateStaticParams() {
  return [];
}

type Params = Promise<{ shower: string; city: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const p = await params;
  const shower = getShower(p.shower);
  const city = getCity(p.city);
  if (!shower || !city) return {};
  const year = nextPeakNoon(shower).getUTCFullYear();
  const title = `${shower.name} ${year} in ${city.name}: best time to watch | Look Up`;
  const description = `When to watch the ${singular(shower)} meteor shower from ${city.name} in ${year}: the peak night, the best hour, where to look and how much the moon gets in the way.`;
  const path = `/meteor-showers/${shower.key}/${city.slug}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path },
  };
}

export default async function ShowerCityPage({ params }: { params: Params }) {
  const p = await params;
  const shower = getShower(p.shower);
  const city = getCity(p.city);
  if (!shower || !city) notFound();

  const f = showerForecast(shower, { lat: city.lat, lon: city.lon, elevation: 0 });
  const night = f.dusk ? peakNight(new Date(f.dusk), city.tz) : peakNight(nextPeakNoon(shower));

  const rows: [string, string][] = f.dusk
    ? [
        ["Gets dark", timeIn(f.dusk, city.tz)],
        ["Radiant rises", radiantLine(f, city.tz)],
        ...(f.visible && f.best ? [["Best time", bestTime(f, city.tz, "label")] as [string, string]] : []),
        ...(f.dawn ? [["Light again", timeIn(f.dawn, city.tz)] as [string, string]] : []),
        ["Moon", moonLine(f, city.tz)],
      ]
    : [];

  return (
    <PageShell>
      <PageTitle kicker={`${city.name}, ${city.country}`}>
        {shower.name} {f.year} from {city.name}
      </PageTitle>
      <p className="font-display mt-5 max-w-xl text-lg leading-relaxed text-ink-soft sm:text-xl">
        {summaryLine(shower, city, f, night)}
      </p>

      {rows.length > 0 && (
        <section className="mt-12">
          <h2 className="kicker mb-2">The night at a glance</h2>
          <dl>
            {rows.map(([label, value]) => (
              <div
                key={label}
                className="flex items-baseline justify-between gap-6 border-t border-[var(--line)] py-4"
              >
                <dt className="text-[15px] text-ink-soft">{label}</dt>
                <dd className="tnum text-right text-[15px] text-ink">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-ink-dim">
            Times are local to {city.name}, worked out for the city centre. Dark means the sun is
            12 degrees below the horizon.
          </p>
        </section>
      )}

      {f.visible && f.best && (
        <section className="mt-12">
          <h2 className="kicker mb-3">Where to look</h2>
          <p className="max-w-xl text-[15px] leading-relaxed text-ink-soft/90">
            Meteors can appear anywhere in the sky. They streak away from the radiant, which sits{" "}
            {lookPhrase(f.best.altitude, f.best.azimuth)} at its best. Face that way but keep
            your gaze wide. Give your eyes twenty minutes to adjust and keep your phone in your
            pocket. The darker your spot, the more you will see.
          </p>
        </section>
      )}

      <section className="mt-12">
        <h2 className="kicker mb-3">About the {shower.name}</h2>
        <p className="max-w-xl text-[15px] leading-relaxed text-ink-soft/90">{aboutLine(shower)}</p>
      </section>

      <section className="mt-12">
        <Link
          href={`/sky/${city.slug}`}
          className="cta inline-block rounded-full px-6 py-3.5 text-[15px] font-medium"
        >
          See tonight&apos;s sky above {city.name}
        </Link>
      </section>

      <section className="mt-14">
        <h2 className="kicker mb-4">The {shower.name} from nearby</h2>
        <ChipList>
          {nearbyCities(city).map((c) => (
            <li key={c.slug}>
              <ChipLink href={`/meteor-showers/${shower.key}/${c.slug}`}>{c.name}</ChipLink>
            </li>
          ))}
          <li>
            <ChipLink href={`/meteor-showers/${shower.key}`}>All cities</ChipLink>
          </li>
        </ChipList>
      </section>
    </PageShell>
  );
}
