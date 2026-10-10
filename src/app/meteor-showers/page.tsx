import type { Metadata } from "next";
import Link from "next/link";
import PageShell, { PageTitle } from "@/components/PageShell";
import { showersByNextPeak } from "@/lib/astro/shower-forecast";
import { peakNight } from "@/lib/shower-copy";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Meteor shower calendar: next peaks and when to watch | Look Up",
  description:
    "The next peak night of every major meteor shower, with the best time to watch worked out for your city.",
  alternates: { canonical: "/meteor-showers" },
};

export default function ShowersPage() {
  return (
    <PageShell>
      <PageTitle>Meteor showers, in order of the next peak</PageTitle>
      <p className="font-display mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
        Pick a shower to see the best hour to watch from your city.
      </p>
      <ul className="mt-10 flex flex-col">
        {showersByNextPeak().map(({ shower, peak }) => (
          <li key={shower.key} className="border-t border-[var(--line)] py-5">
            <Link href={`/meteor-showers/${shower.key}`} className="group block">
              <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-display text-xl text-ink group-hover:text-starlight">
                  {shower.name} {peak.getUTCFullYear()}
                </span>
                <span className="tnum font-mono text-[13px] text-starlight">{peakNight(peak)}</span>
              </span>
              <span className="mt-1 block text-[14px] leading-relaxed text-ink-soft">
                Up to {shower.zhr} an hour at best: {shower.blurb}.
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
