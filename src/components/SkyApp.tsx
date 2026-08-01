"use client";

import { useCallback, useEffect, useState } from "react";
import type { Place, SkyEvent, SkyReport } from "@/lib/astro/types";
import {
  countdown,
  hueVar,
  isHappeningNow,
  kindLabel,
  localTime,
  localTimeSeconds,
  rarityWhisper,
} from "@/lib/format";
import Starfield from "./Starfield";
import LocationGate from "./LocationGate";
import SkyPointer from "./SkyPointer";
import AlertOptIn from "./AlertOptIn";

function StarMark() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className="inline-block">
      <path
        d="M5 0 L6 4 L10 5 L6 6 L5 10 L4 6 L0 5 L4 4 Z"
        fill="var(--starlight)"
      />
    </svg>
  );
}

const PLACE_KEY = "lookup.place";

export default function SkyApp() {
  const [place, setPlace] = useState<Place | null>(null);
  const [report, setReport] = useState<SkyReport | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [now, setNow] = useState(() => Date.now());

  // a shared link opens straight to that place; otherwise restore the last one
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const latStr = sp.get("lat");
      const lonStr = sp.get("lon");
      // only treat as a shared link when both coords are actually present
      if (latStr !== null && lonStr !== null) {
        const lat = Number(latStr);
        const lon = Number(lonStr);
        if (isFinite(lat) && isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
          setPlace({ lat, lon, elevation: 0, label: sp.get("name") ?? undefined });
          return;
        }
      }
      const raw = localStorage.getItem(PLACE_KEY);
      if (raw) setPlace(JSON.parse(raw));
    } catch {}
  }, []);

  // one heartbeat drives every countdown on the page
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async (p: Place) => {
    setStatus("loading");
    try {
      const res = await fetch(`/api/sky?lat=${p.lat}&lon=${p.lon}`);
      if (!res.ok) throw new Error("bad response");
      const data: SkyReport = await res.json();
      setReport(data);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (place) {
      try {
        localStorage.setItem(PLACE_KEY, JSON.stringify(place));
      } catch {}
      load(place);
    }
  }, [place, load]);

  function changePlace() {
    localStorage.removeItem(PLACE_KEY);
    setPlace(null);
    setReport(null);
  }

  if (!place) return <LocationGate onPlace={setPlace} />;

  const hero = report?.events[0];
  const rest = report?.events.slice(1) ?? [];
  const placeName = place.label ?? `${place.lat.toFixed(2)}, ${place.lon.toFixed(2)}`;

  return (
    <main className="night min-h-[100dvh]">
      <Starfield />
      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-[680px] flex-col px-6 pb-16">
        {/* top bar */}
        <header className="flex items-center justify-between py-6">
          <span className="kicker inline-flex items-center gap-2">
            <StarMark /> Look Up
          </span>
          <button
            onClick={changePlace}
            className="text-[13px] text-ink-dim transition hover:text-ink-soft"
          >
            {placeName} · change
          </button>
        </header>

        {status === "loading" && !report && <Loading />}
        {status === "error" && (
          <div className="flex flex-1 items-center justify-center text-center text-ink-soft">
            <div>
              <p>The sky went quiet for a moment.</p>
              <button
                onClick={() => load(place)}
                className="mt-3 text-starlight underline-offset-4 hover:underline"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {hero && (
          <>
            <Hero event={hero} now={now} place={place} />
            {rest.length > 0 && (
              <section
                className="rise mt-16"
                style={{ ["--rise-delay" as string]: "600ms" }}
              >
                <p className="kicker mb-5">Also tonight</p>
                <ul className="flex flex-col">
                  {rest.map((e, i) => (
                    <EventRow key={e.id} event={e} now={now} soonest={i === 0} index={i} />
                  ))}
                </ul>
              </section>
            )}
            <Footer report={report!} />
          </>
        )}
      </div>
    </main>
  );
}

function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <p className="kicker animate-pulse">Reading the sky above you…</p>
    </div>
  );
}

function Hero({ event, now, place }: { event: SkyEvent; now: number; place: Place }) {
  const timed = !!event.when;
  const live = isHappeningNow(event.windowStart, event.windowEnd, now);
  const cd = event.when ? countdown(event.when, now) : null;
  const whisper = rarityWhisper(event.rarity);
  const hasPointer = event.azimuth != null && event.altitude != null;
  const isTransit = event.id.startsWith("transit");

  return (
    <section className="mt-4">
      <p
        className="kicker rise mb-6"
        style={{ color: hueVar(event.kind), ["--rise-delay" as string]: "40ms" }}
      >
        {live ? "Right now, look up for" : "Tonight, look up for"}
      </p>
      <h1
        className="rise font-display text-[2.6rem] leading-[1.04] tracking-[-0.02em] text-ink sm:text-6xl"
        style={{ ["--rise-delay" as string]: "120ms" }}
      >
        {event.title}
      </h1>
      <p
        className="rise font-display mt-5 max-w-xl text-lg leading-relaxed text-ink-soft sm:text-xl"
        style={{ ["--rise-delay" as string]: "200ms" }}
      >
        {event.subtitle}
      </p>

      {/* the data line */}
      <div
        className="rise mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 text-[15px]"
        style={{ ["--rise-delay" as string]: "280ms" }}
      >
        {timed ? (
          live ? (
            <span className="inline-flex items-center gap-2 font-medium text-starlight">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-starlight opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-starlight" />
              </span>
              Happening now
            </span>
          ) : (
            <span className="breathe tnum font-mono text-xl font-medium tracking-tight text-starlight">
              {cd}
            </span>
          )
        ) : (
          <span className="text-ink-soft">Any time it&apos;s dark</span>
        )}
        {event.direction && (
          <>
            <Dot />
            <span className="text-ink-soft">{event.direction}</span>
          </>
        )}
        {event.durationMin != null && (
          <>
            <Dot />
            <span className="text-ink-soft">{event.durationMin} min</span>
          </>
        )}
        {event.when && (
          <>
            <Dot />
            <span className={isTransit ? "tnum text-starlight" : "text-ink-dim"}>
              {isTransit ? localTimeSeconds(event.when) : localTime(event.when)}
            </span>
          </>
        )}
      </div>

      {hasPointer && (
        <div className="rise" style={{ ["--rise-delay" as string]: "340ms" }}>
          <SkyPointer
            azimuth={event.azimuth!}
            altitude={event.altitude!}
            kind={event.kind}
          />
        </div>
      )}

      <div className="rise" style={{ ["--rise-delay" as string]: "400ms" }}>
        <AlertOptIn place={place} />
      </div>

      {whisper && (
        <p
          className="rise mt-8 text-[15px] text-starlight/90"
          style={{ ["--rise-delay" as string]: "460ms" }}
        >
          {whisper}
        </p>
      )}

      <p
        className="rise mt-5 max-w-xl text-[15px] leading-relaxed text-ink-soft/90"
        style={{ ["--rise-delay" as string]: "520ms" }}
      >
        {event.detail}
      </p>
    </section>
  );
}

function EventRow({
  event,
  now,
  soonest,
  index,
}: {
  event: SkyEvent;
  now: number;
  soonest: boolean;
  index: number;
}) {
  const [open, setOpen] = useState(false);
  const when = event.when ? localTime(event.when) : "all night";
  const cd = event.when ? countdown(event.when, now) : null;
  // the most time-sensitive number on the list earns the brightest ink
  const timeColor = soonest && cd ? "text-starlight" : "text-ink-dim";

  return (
    <li
      className="rise border-t border-[var(--line)]"
      style={{ ["--rise-delay" as string]: `${640 + index * 60}ms` }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-baseline gap-4 py-5 text-left"
      >
        <span
          aria-hidden
          className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
          style={{ background: hueVar(event.kind), boxShadow: `0 0 10px ${hueVar(event.kind)}` }}
        />
        <span className="flex-1">
          <span className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="font-display text-xl text-ink">{event.title}</span>
            <span className={`tnum font-mono text-[13px] ${timeColor}`}>{cd ?? when}</span>
          </span>
          <span className="mt-1 block text-[14px] leading-relaxed text-ink-soft">
            {event.subtitle}
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-dim">
            <span>{kindLabel(event.kind)}</span>
            <Dot />
            <span>{event.tag}</span>
          </span>
          {open && (
            <span className="mt-3 block max-w-xl text-[14px] leading-relaxed text-ink-soft/90">
              {event.detail}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

function Footer({ report }: { report: SkyReport }) {
  return (
    <>
      {report.comingUp && (
        <section className="mt-14">
          <p className="kicker mb-3">On the horizon</p>
          <p className="font-display text-xl text-ink">{report.comingUp.title}</p>
          <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">
            {report.comingUp.note}
          </p>
        </section>
      )}
      <ShareSky place={report.place} />
      <footer className="mt-14 border-t border-[var(--line)] pt-6 text-xs leading-relaxed text-ink-dim">
        <p>
          Worked out for your exact coordinates from live satellite tracking,
          NOAA space-weather data, and where the sun, moon and planets actually
          are right now.
        </p>
        {report.night.dusk && (
          <p className="mt-2">
            Tonight gets dark around {localTime(report.night.dusk)}
            {report.night.dawn ? `, light again by ${localTime(report.night.dawn)}` : ""}.
          </p>
        )}
      </footer>
    </>
  );
}

function ShareSky({ place }: { place: Place }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    // round raw GPS to ~1km so a shared link never exposes an exact address
    const named = !!place.label;
    const lat = named ? place.lat : Math.round(place.lat * 100) / 100;
    const lon = named ? place.lon : Math.round(place.lon * 100) / 100;
    const q = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      ...(place.label ? { name: place.label } : {}),
    });
    const url = `${window.location.origin}/?${q.toString()}`;
    const text = place.label
      ? `The sky above ${place.label} tonight`
      : "The sky above me tonight";
    try {
      if (navigator.share) {
        await navigator.share({ title: "Look Up", text, url });
        return;
      }
    } catch {
      return; // user dismissed the share sheet
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {}
  }

  return (
    <div className="mt-12">
      <button
        onClick={share}
        className="text-[15px] text-ink-soft underline-offset-4 transition hover:text-starlight hover:underline"
      >
        {copied ? "Link copied" : "Share tonight's sky"}
      </button>
    </div>
  );
}

function Dot() {
  return <span className="text-ink-dim/50">·</span>;
}
