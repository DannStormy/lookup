import type { Metadata } from "next";
import Link from "next/link";
import CityLinks from "@/components/CityLinks";
import PageShell, { PageTitle } from "@/components/PageShell";

export const metadata: Metadata = {
  title: "Tonight's night sky by city | Look Up",
  description:
    "What is visible in the night sky tonight, city by city: space station passes, planets, the moon and meteor showers, with exact local times.",
  alternates: { canonical: "/sky" },
};

export default function CitiesPage() {
  return (
    <PageShell>
      <PageTitle>Tonight&apos;s sky, city by city</PageTitle>
      <p className="font-display mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
        Pick a city to see what is overhead tonight and when to look. Or{" "}
        <Link href="/" className="text-starlight underline-offset-4 hover:underline">
          use your exact location
        </Link>
        .
      </p>
      <CityLinks hrefFor={(c) => `/sky/${c.slug}`} />
    </PageShell>
  );
}
