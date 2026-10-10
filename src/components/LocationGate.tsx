"use client";

import { useState } from "react";
import Link from "next/link";
import type { Place } from "@/lib/astro/types";

const CITIES: { label: string; lat: number; lon: number }[] = [
  { label: "London", lat: 51.5074, lon: -0.1278 },
  { label: "New York", lat: 40.7128, lon: -74.006 },
  { label: "Lagos", lat: 6.5244, lon: 3.3792 },
  { label: "Los Angeles", lat: 34.0522, lon: -118.2437 },
  { label: "Sydney", lat: -33.8688, lon: 151.2093 },
  { label: "Tokyo", lat: 35.6762, lon: 139.6503 },
  { label: "Nairobi", lat: -1.2921, lon: 36.8219 },
  { label: "São Paulo", lat: -23.5558, lon: -46.6396 },
  { label: "Reykjavík", lat: 64.1466, lon: -21.9426 },
];

export default function LocationGate({
  onPlace,
}: {
  onPlace: (p: Place) => void;
}) {
  const [asking, setAsking] = useState(false);
  const [denied, setDenied] = useState(false);

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setDenied(true);
      return;
    }
    setAsking(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onPlace({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          elevation: pos.coords.altitude ?? 0,
        });
      },
      () => {
        setAsking(false);
        setDenied(true);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  }

  return (
    <main className="night flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center">
      <div className="rise relative z-10 max-w-md">
        <p className="kicker mb-6">Look Up</p>
        <h1 className="font-display text-3xl leading-tight text-ink sm:text-4xl">
          Something is always happening
          <br />
          in the sky above you.
        </h1>
        <p className="mt-5 text-[15px] leading-relaxed text-ink-soft">
          The space station crossing overhead. A planet you keep mistaking for a
          star. Meteors, if you know which night. Tell me where you&apos;re
          standing and I&apos;ll tell you what to look for, and exactly when.
        </p>

        <button
          onClick={useMyLocation}
          disabled={asking}
          className="cta mt-9 w-full rounded-full px-6 py-3.5 text-[15px] font-medium disabled:opacity-60"
        >
          {asking ? "Finding your sky…" : "Use my location"}
        </button>
        <p className="mt-3 text-xs text-ink-dim">
          Your coordinates are used only to work out your sky, never shared with
          anyone, and only stored if you switch on alerts.
        </p>

        <div className="mt-10">
          <p className="kicker mb-4">{denied ? "No problem, pick a city" : "or choose a city"}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {CITIES.map((c) => (
              <button
                key={c.label}
                onClick={() => onPlace({ lat: c.lat, lon: c.lon, elevation: 0, label: c.label })}
                className="rounded-full border border-[var(--line)] px-3.5 py-1.5 text-[13px] text-ink-soft transition hover:border-[rgba(244,217,160,0.4)] hover:text-ink"
              >
                {c.label}
              </button>
            ))}
          </div>
          <Link
            href="/sky"
            className="mt-5 inline-block text-[13px] text-ink-dim underline-offset-4 transition hover:text-ink-soft hover:underline"
          >
            More cities
          </Link>
        </div>
      </div>
    </main>
  );
}
