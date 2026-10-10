import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CityLinks from "@/components/CityLinks";
import PageShell, { PageTitle } from "@/components/PageShell";
import { SHOWERS } from "@/lib/astro/meteors";
import { getShower, nextPeakNoon } from "@/lib/astro/shower-forecast";
import { aboutLine, peakNight, singular } from "@/lib/shower-copy";

export const revalidate = 86400;

export function generateStaticParams() {
  return SHOWERS.map((s) => ({ shower: s.key }));
}

type Params = Promise<{ shower: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const shower = getShower((await params).shower);
  if (!shower) return {};
  const year = nextPeakNoon(shower).getUTCFullYear();
  return {
    title: `${shower.name} ${year}: peak night and best time to watch by city | Look Up`,
    description: `When the ${singular(shower)} meteor shower peaks in ${year}, and the best hour to watch from your city.`,
    alternates: { canonical: `/meteor-showers/${shower.key}` },
  };
}

export default async function ShowerPage({ params }: { params: Params }) {
  const shower = getShower((await params).shower);
  if (!shower) notFound();
  const peak = nextPeakNoon(shower);

  return (
    <PageShell>
      <PageTitle kicker="Meteor shower">
        {shower.name} {peak.getUTCFullYear()}
      </PageTitle>
      <p className="font-display mt-5 max-w-xl text-lg leading-relaxed text-ink-soft sm:text-xl">
        The {shower.name} peak on the night of {peakNight(peak)}. The best hour depends on
        where you are, so pick your city below.
      </p>
      <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-ink-soft/90">
        {aboutLine(shower)}
      </p>
      <CityLinks hrefFor={(c) => `/meteor-showers/${shower.key}/${c.slug}`} />
    </PageShell>
  );
}
