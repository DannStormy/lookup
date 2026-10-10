import type { Metadata } from "next";
import Link from "next/link";
import Starfield from "@/components/Starfield";
import { citiesByCountry } from "@/lib/cities";

export const metadata: Metadata = {
  title: "Tonight's night sky by city | Look Up",
  description:
    "What is visible in the night sky tonight, city by city: space station passes, planets, the moon and meteor showers, with exact local times.",
  alternates: { canonical: "/sky" },
};

export default function CitiesPage() {
  return (
    <main className="night min-h-[100dvh]">
      <Starfield />
      <div className="relative z-10 mx-auto max-w-[680px] px-6 pb-16">
        <header className="py-6">
          <Link href="/" className="kicker">
            Look Up
          </Link>
        </header>

        <h1 className="mt-4 font-display text-[2.6rem] leading-[1.04] tracking-[-0.02em] text-ink sm:text-6xl">
          Tonight&apos;s sky, city by city
        </h1>
        <p className="font-display mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
          Pick a city to see what is overhead tonight and when to look. Or{" "}
          <Link href="/" className="text-starlight underline-offset-4 hover:underline">
            use your exact location
          </Link>
          .
        </p>

        {citiesByCountry().map(({ country, cities }) => (
          <section key={country} className="mt-10">
            <h2 className="kicker mb-4">{country}</h2>
            <ul className="flex flex-wrap gap-2">
              {cities.map((c) => (
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
        ))}
      </div>
    </main>
  );
}
