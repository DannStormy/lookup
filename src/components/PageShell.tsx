import Link from "next/link";
import Starfield from "./Starfield";

export default function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="night min-h-[100dvh]">
      <Starfield />
      <div className="relative z-10 mx-auto max-w-[680px] px-6 pb-16">
        <header className="flex items-center justify-between py-6">
          <Link href="/" className="kicker">
            Look Up
          </Link>
          <nav className="flex gap-5 text-[13px] text-ink-dim">
            <Link href="/sky" className="transition hover:text-ink-soft">
              Cities
            </Link>
            <Link href="/meteor-showers" className="transition hover:text-ink-soft">
              Meteor showers
            </Link>
          </nav>
        </header>
        {children}
      </div>
    </main>
  );
}

export function PageTitle({ kicker, children }: { kicker?: string; children: React.ReactNode }) {
  return (
    <>
      {kicker && <p className="kicker mb-6 mt-4">{kicker}</p>}
      <h1
        className={`font-display text-[2.6rem] leading-[1.04] tracking-[-0.02em] text-ink sm:text-6xl ${kicker ? "" : "mt-4"}`}
      >
        {children}
      </h1>
    </>
  );
}
