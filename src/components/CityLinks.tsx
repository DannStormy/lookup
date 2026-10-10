import Link from "next/link";
import { citiesByCountry, type City } from "@/lib/cities";

export function ChipLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-block rounded-full border border-[var(--line)] px-3.5 py-1.5 text-[13px] text-ink-soft transition hover:border-[rgba(244,217,160,0.4)] hover:text-ink"
    >
      {children}
    </Link>
  );
}

export function ChipList({ children }: { children: React.ReactNode }) {
  return <ul className="flex flex-wrap gap-2">{children}</ul>;
}

export default function CityLinks({ hrefFor }: { hrefFor: (city: City) => string }) {
  return (
    <>
      {citiesByCountry().map(({ country, cities }) => (
        <section key={country} className="mt-10">
          <h2 className="kicker mb-4">{country}</h2>
          <ChipList>
            {cities.map((c) => (
              <li key={c.slug}>
                <ChipLink href={hrefFor(c)}>{c.name}</ChipLink>
              </li>
            ))}
          </ChipList>
        </section>
      ))}
    </>
  );
}
