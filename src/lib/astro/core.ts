// Shared sky geometry helpers built on astronomy-engine.
import {
  Observer,
  Body,
  Equator,
  Horizon,
  SearchRiseSet,
  SearchAltitude,
} from "astronomy-engine";
import type { Place } from "./types";

// astronomy-engine takes rise/set direction as a plain number.
const RISE = 1;
const SET = -1;

export function observerOf(place: Place): Observer {
  return new Observer(place.lat, place.lon, place.elevation ?? 0);
}

export interface AltAz {
  altitude: number; // degrees above horizon (can be negative)
  azimuth: number; // degrees, 0=N, 90=E, 180=S, 270=W
}

/** Apparent topocentric altitude/azimuth of a solar-system body, right now. */
export function altAz(body: Body, date: Date, obs: Observer): AltAz {
  const eq = Equator(body, date, obs, true, true);
  const hor = Horizon(date, obs, eq.ra, eq.dec, "normal");
  return { altitude: hor.altitude, azimuth: hor.azimuth };
}

/** Altitude/azimuth of a fixed point on the sky (a star, a meteor radiant). */
export function altAzRaDec(
  raHours: number,
  decDeg: number,
  date: Date,
  obs: Observer,
): AltAz {
  const hor = Horizon(date, obs, raHours, decDeg, "normal");
  return { altitude: hor.altitude, azimuth: hor.azimuth };
}

/** How high the sun is. Below -6 = civil dusk, below -18 = truly dark. */
export function sunAltitude(date: Date, obs: Observer): number {
  return altAz(Body.Sun, date, obs).altitude;
}

/**
 * Tonight's darkness window: from the next time the sun sinks past `duskAngle`
 * to the following dawn. Returns nulls where the sun never sets (polar summer)
 * or never rises high enough (polar winter darkness handled by caller).
 */
export function nightWindow(
  from: Date,
  obs: Observer,
  duskAngle = -12,
): { dusk: Date | null; dawn: Date | null } {
  // SearchAltitude finds when the sun crosses a given altitude.
  const dusk = SearchAltitude(Body.Sun, obs, SET, from, 1.5, duskAngle);
  const searchDawnFrom = dusk ? dusk.date : from;
  const dawn = SearchAltitude(
    Body.Sun,
    obs,
    RISE,
    searchDawnFrom,
    1.5,
    duskAngle,
  );
  return { dusk: dusk?.date ?? null, dawn: dawn?.date ?? null };
}

export function riseSet(
  body: Body,
  obs: Observer,
  from: Date,
): { rise: Date | null; set: Date | null } {
  const rise = SearchRiseSet(body, obs, RISE, from, 1.2);
  const set = SearchRiseSet(body, obs, SET, from, 1.2);
  return { rise: rise?.date ?? null, set: set?.date ?? null };
}

const COMPASS = [
  "north",
  "northeast",
  "east",
  "southeast",
  "south",
  "southwest",
  "west",
  "northwest",
];

/** Turn a bearing into a plain compass word. */
export function compass(azimuth: number): string {
  const i = Math.round(((azimuth % 360) / 45)) % 8;
  return COMPASS[(i + 8) % 8];
}

/** Turn an altitude into a felt height. */
export function heightWord(altitude: number): string {
  if (altitude < 12) return "low on the horizon";
  if (altitude < 35) return "low";
  if (altitude < 60) return "partway up";
  if (altitude < 80) return "high";
  return "almost straight overhead";
}

/** "low in the northwest", "high in the south". */
export function lookPhrase(altitude: number, azimuth: number): string {
  if (altitude >= 80) return "almost straight overhead";
  return `${heightWord(altitude)} in the ${compass(azimuth)}`;
}

export function isDark(date: Date, obs: Observer, angle = -12): boolean {
  return sunAltitude(date, obs) < angle;
}
