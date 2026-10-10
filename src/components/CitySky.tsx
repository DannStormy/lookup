"use client";

import { useEffect, useState } from "react";
import type { SkyEvent, SkyReport } from "@/lib/astro/types";
import type { City } from "@/lib/cities";
import { dayTimeIn, hueVar, kindLabel, timeIn } from "@/lib/format";

const STALE_MS = 20 * 60 * 1000;

export default function CitySky({ city, initial }: { city: City; initial: SkyReport }) {
  const [report, setReport] = useState(initial);

  // The cached page can be older than the sky it describes; refresh for real visitors.
  useEffect(() => {
    if (Date.now() - Date.parse(initial.generatedAt) < STALE_MS) return;
    let cancelled = false;
    fetch(`/api/sky?lat=${city.lat}&lon=${city.lon}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((fresh: SkyReport | null) => {
        if (fresh && !cancelled) setReport(fresh);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [city.lat, city.lon, initial.generatedAt]);

  const { night, darkNow, events, comingUp, generatedAt } = report;
  const moonPct = Math.round(report.moonIllumination * 100);

  return (
    <>
      <p className="font-display mt-5 max-w-xl text-lg leading-relaxed text-ink-soft sm:text-xl">
        {darknessLine(city, night.dusk, night.dawn, darkNow)} The moon is {moonPct}% lit.
      </p>

      <section className="mt-12">
        <h2 className="kicker mb-5">What to look for</h2>
        <ul className="flex flex-col">
          {events.map((e) => (
            <EventItem key={e.id} event={e} tz={city.tz} now={generatedAt} />
          ))}
        </ul>
      </section>

      {comingUp && (
        <section className="mt-12">
          <h2 className="kicker mb-3">On the horizon</h2>
          <p className="font-display text-xl text-ink">{comingUp.title}</p>
          <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">{comingUp.note}</p>
        </section>
      )}

      <p className="mt-10 text-xs text-ink-dim">
        All times are local to {city.name}. Last updated at {timeIn(generatedAt, city.tz)}.
      </p>
    </>
  );
}

function darknessLine(
  city: City,
  dusk: string | null,
  dawn: string | null,
  darkNow: boolean,
): string {
  if (!dusk) {
    return darkNow
      ? `It is dark in ${city.name} right now.`
      : `The sky does not get fully dark in ${city.name} tonight.`;
  }
  if (darkNow) {
    return `It is dark in ${city.name} right now. The next night begins around ${timeIn(dusk, city.tz)}.`;
  }
  const until = dawn ? ` and light again by ${timeIn(dawn, city.tz)}` : "";
  return `Tonight ${city.name} gets dark around ${timeIn(dusk, city.tz)}${until}.`;
}

function whenLabel(event: SkyEvent, tz: string, now: string): string {
  if (!event.when) return "Any time it's dark";
  const at = dayTimeIn(event.when, tz, now);
  // the moon's `when` is its rise time, not a moment to look
  if (event.kind === "moon") return `Rises ${at.replace(/^(Today|Tomorrow)/, (d) => d.toLowerCase())}`;
  return at;
}

function EventItem({ event, tz, now }: { event: SkyEvent; tz: string; now: string }) {
  const when = whenLabel(event, tz, now);
  return (
    <li className="border-t border-[var(--line)] py-5">
      <div className="flex items-baseline gap-4">
        <span
          aria-hidden
          className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
          style={{ background: hueVar(event.kind), boxShadow: `0 0 10px ${hueVar(event.kind)}` }}
        />
        <div className="flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <h3 className="font-display text-xl text-ink">{event.title}</h3>
            <span className="tnum font-mono text-[13px] text-starlight">{when}</span>
          </div>
          <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">{event.subtitle}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-dim">
            <span>{kindLabel(event.kind)}</span>
            <span className="text-ink-dim/50">·</span>
            <span>{event.tag}</span>
            {event.durationMin != null && (
              <>
                <span className="text-ink-dim/50">·</span>
                <span>{event.durationMin} min</span>
              </>
            )}
          </p>
          <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-ink-soft/90">
            {event.detail}
          </p>
        </div>
      </div>
    </li>
  );
}
