import { Body } from "astronomy-engine";
import { altAz, altAzRaDec, nightWindow, observerOf } from "./core";
import { estimatedRate, SHOWERS, type Shower } from "./meteors";
import { moonIlluminationFraction } from "./moon";
import type { Place } from "./types";

const STEP_MS = 10 * 60 * 1000;
const HOUR_MS = 3600 * 1000;

export interface ShowerForecast {
  /** calendar year of the peak this forecast is for */
  year: number;
  /** false when the sky never darkens or the radiant never clears the horizon */
  visible: boolean;
  dusk: string | null;
  dawn: string | null;
  radiant: {
    upAtDusk: boolean;
    /** when it clears the horizon during the night, if it starts below */
    rises: string | null;
    maxAltitude: number;
  };
  best: { at: string; rate: number; altitude: number; azimuth: number } | null;
  moon: {
    lit: number; // 0..1
    /** how it behaves across the dark hours */
    state: "down" | "up" | "sets" | "rises";
    at: string | null;
  };
}

export function getShower(key: string): Shower | undefined {
  return SHOWERS.find((s) => s.key === key);
}

/** UTC noon on the next peak date still ahead (a peak stays "next" until the day after). */
export function nextPeakNoon(shower: Shower, now = new Date()): Date {
  const y = now.getUTCFullYear();
  for (const year of [y, y + 1]) {
    const noon = new Date(Date.UTC(year, shower.peakMonth - 1, shower.peakDay, 12));
    if (noon.getTime() + 36 * HOUR_MS > now.getTime()) return noon;
  }
  return new Date(Date.UTC(y + 1, shower.peakMonth - 1, shower.peakDay, 12));
}

export function showersByNextPeak(now = new Date()): { shower: Shower; peak: Date }[] {
  return SHOWERS.map((shower) => ({ shower, peak: nextPeakNoon(shower, now) })).sort(
    (a, b) => a.peak.getTime() - b.peak.getTime(),
  );
}

export function showerForecast(shower: Shower, place: Place, now = new Date()): ShowerForecast {
  const obs = observerOf(place);
  const peakNoon = nextPeakNoon(shower, now);
  const year = peakNoon.getUTCFullYear();
  // local solar noon on the peak date, so "the night" is the evening that follows
  const localNoon = new Date(peakNoon.getTime() - (place.lon / 15) * HOUR_MS);
  const { dusk, dawn } = nightWindow(localNoon, obs, -12);

  const empty: ShowerForecast = {
    year,
    visible: false,
    dusk: dusk?.toISOString() ?? null,
    dawn: dawn?.toISOString() ?? null,
    radiant: { upAtDusk: false, rises: null, maxAltitude: -90 },
    best: null,
    moon: { lit: moonIlluminationFraction(localNoon), state: "down", at: null },
  };
  if (!dusk) return empty;

  const start = dusk.getTime();
  const end = dawn ? dawn.getTime() : start + 12 * HOUR_MS;
  const moonLit = moonIlluminationFraction(new Date((start + end) / 2));

  let best: ShowerForecast["best"] = null;
  let maxAltitude = -90;
  let rises: string | null = null;
  let upAtDusk = false;
  let moonUpAtStart = false;
  let moonChange: string | null = null;
  let moonUpCount = 0;
  let samples = 0;

  for (let t = start; t <= end; t += STEP_MS) {
    const at = new Date(t);
    const radiant = altAzRaDec(shower.raHours, shower.decDeg, at, obs);
    const moonUp = altAz(Body.Moon, at, obs).altitude > 0;

    if (samples === 0) {
      upAtDusk = radiant.altitude > 0;
      moonUpAtStart = moonUp;
    } else {
      if (!upAtDusk && !rises && radiant.altitude > 0) rises = at.toISOString();
      if (!moonChange && moonUp !== moonUpAtStart) moonChange = at.toISOString();
    }
    if (moonUp) moonUpCount++;
    samples++;

    maxAltitude = Math.max(maxAltitude, radiant.altitude);
    const rate = estimatedRate(shower.zhr, radiant.altitude, moonUp, moonLit);
    if (!best || rate > best.rate) {
      best = { at: at.toISOString(), rate, altitude: radiant.altitude, azimuth: radiant.azimuth };
    }
  }

  const moonState: ShowerForecast["moon"]["state"] =
    moonUpCount === 0 ? "down" : moonUpCount === samples ? "up" : moonUpAtStart ? "sets" : "rises";

  return {
    year,
    visible: maxAltitude >= 5 && !!best && best.rate >= 1,
    dusk: dusk.toISOString(),
    dawn: dawn?.toISOString() ?? null,
    radiant: { upAtDusk, rises, maxAltitude },
    best: best && { ...best, rate: Math.round(best.rate) },
    moon: { lit: moonLit, state: moonState, at: moonChange },
  };
}
