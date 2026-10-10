// Comets, done honestly: real Keplerian orbits from live MPC elements, real
// predicted brightness, real per-observer visibility. Nothing hardcoded as
// "visible" — the maths decides, so a quiet sky simply shows no comet.

import {
  MakeTime,
  Vector,
  Body,
  HelioVector,
  Rotation_ECL_EQJ,
  RotateVector,
  EquatorFromVector,
  Horizon,
  type Observer,
} from "astronomy-engine";
import { cometHeliocentric, type OrbitalElements } from "./comet-kepler";
import { lookPhrase, sunAltitude } from "./core";
import type { Place, SkyEvent } from "./types";

export interface CometRecord extends OrbitalElements {
  name: string;
  m1: number; // total absolute magnitude (H)
  k1: number; // magnitude slope
}

const COMETELS_URL = "https://www.minorplanetcenter.net/iau/MPCORB/CometEls.txt";
const LIGHT_AU_PER_DAY = 173.144632674;

// A few well-determined comets, so the engine always has real data to chew on
// even if the MPC fetch fails. (None are currently bright, so none will show.)
const SEED: CometRecord[] = [
  { name: "1P/Halley", q: 0.585978, e: 0.967142, iDeg: 162.192, nodeDeg: 59.396, periDeg: 112.259, tp: Date.UTC(1986, 1, 9, 2, 47), m1: 4.0, k1: 6.0 },
  { name: "C/1995 O1 (Hale-Bopp)", q: 0.914169, e: 0.995086, iDeg: 89.288, nodeDeg: 282.471, periDeg: 130.662, tp: tpToMs(1997, 4, 1.1373), m1: -1.0, k1: 4.0 },
  { name: "C/2020 F3 (NEOWISE)", q: 0.294700, e: 0.999200, iDeg: 128.937, nodeDeg: 61.011, periDeg: 37.274, tp: tpToMs(2020, 7, 3.6813), m1: 7.5, k1: 5.2 },
];

function tpToMs(year: number, month: number, dayFrac: number): number {
  return Date.UTC(year, month - 1, 1) + (dayFrac - 1) * 86400000;
}

function num(s: string): number {
  return parseFloat(s.trim());
}

/** Parse the MPC fixed-width CometEls.txt into orbital records. */
export function parseCometEls(text: string): CometRecord[] {
  const out: CometRecord[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.length < 100) continue;
    const year = parseInt(line.substring(14, 18), 10);
    const month = parseInt(line.substring(19, 21), 10);
    const dayFrac = num(line.substring(22, 29));
    const q = num(line.substring(30, 39));
    const e = num(line.substring(41, 49));
    const peri = num(line.substring(51, 59));
    const node = num(line.substring(61, 69));
    const inc = num(line.substring(71, 79));
    const m1 = num(line.substring(91, 95));
    const k1 = num(line.substring(96, 100));
    const name = line.substring(102, 158).trim();
    if (![year, month, dayFrac, q, e, peri, node, inc].every(isFinite)) continue;
    out.push({
      name: name || "Comet",
      q,
      e,
      iDeg: inc,
      nodeDeg: node,
      periDeg: peri,
      tp: tpToMs(year, month, dayFrac),
      m1: isFinite(m1) ? m1 : 12,
      k1: isFinite(k1) ? k1 : 10,
    });
  }
  return out;
}

let cache: { at: number; comets: CometRecord[] } | null = null;
const TTL = 6 * 60 * 60 * 1000;

async function getComets(): Promise<CometRecord[]> {
  if (cache && Date.now() - cache.at < TTL) return cache.comets;
  try {
    const res = await fetch(COMETELS_URL, {
      headers: { "User-Agent": "lookup-sky/0.1 (astronomy hobby app)" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`mpc ${res.status}`);
    const comets = parseCometEls(await res.text());
    if (comets.length) {
      cache = { at: Date.now(), comets };
      return comets;
    }
    throw new Error("empty");
  } catch {
    if (cache) return cache.comets;
    // cache the fallback briefly so a down/slow MPC isn't hit every request
    cache = { at: Date.now() - TTL + 20 * 60 * 1000, comets: SEED };
    return SEED;
  }
}

export interface CometSky {
  ra: number; // hours
  dec: number; // deg
  delta: number; // comet-Earth distance, AU
  r: number; // comet-Sun distance, AU
  mag: number;
}

/** Geocentric RA/Dec + distances + predicted magnitude, with light-time. */
export function cometPosition(rec: CometRecord, date: Date): CometSky {
  const time = MakeTime(date);
  const rot = Rotation_ECL_EQJ(); // fixed J2000 ecliptic->equatorial rotation
  const earth = HelioVector(Body.Earth, time);

  let atMs = date.getTime();
  let geo = new Vector(0, 0, 0, time);
  let r = 0;
  // one light-time iteration is plenty for a viewing app
  for (let i = 0; i < 2; i++) {
    const h = cometHeliocentric(rec, atMs);
    r = h.r;
    const eqj = RotateVector(rot, new Vector(h.x, h.y, h.z, time));
    geo = new Vector(eqj.x - earth.x, eqj.y - earth.y, eqj.z - earth.z, time);
    const delta = Math.hypot(geo.x, geo.y, geo.z);
    atMs = date.getTime() - (delta / LIGHT_AU_PER_DAY) * 86400000;
  }

  const eq = EquatorFromVector(geo);
  const delta = eq.dist;
  const mag = rec.m1 + 5 * Math.log10(delta) + rec.k1 * Math.log10(r);
  return { ra: eq.ra, dec: eq.dec, delta, r, mag };
}

/** Bright comets that are up during darkness at this place, right now. */
export async function cometEvents(when: Date, obs: Observer, place: Place): Promise<SkyEvent[]> {
  // must be at least twilight-dark to bother
  if (sunAltitude(when, obs) > -6) return [];
  const comets = await getComets();
  const out: SkyEvent[] = [];

  for (const c of comets) {
    const pos = cometPosition(c, when);
    // naked-eye is ~6; allow binocular comets up to ~8.5, ignore the rest
    if (!isFinite(pos.mag) || pos.mag > 8.5) continue;
    const hor = Horizon(when, obs, pos.ra, pos.dec, "normal");
    if (hor.altitude < 5) continue;

    const nakedEye = pos.mag <= 6;
    const dir = lookPhrase(hor.altitude, hor.azimuth);
    const cleanName = c.name.replace(/\s*\([^)]*\)\s*$/, ""); // strip "(NEOWISE)" etc.
    const display = /\(/.test(c.name) ? c.name.replace(/^[^(]*\(([^)]*)\)/, "$1") : cleanName;

    out.push({
      id: `comet-${c.name.replace(/[^a-z0-9]/gi, "")}`,
      kind: "meteor", // reuse the violet, deep-sky hue
      title: `Comet ${display}`,
      subtitle: nakedEye
        ? `A comet is visible to the naked eye, ${dir}.`
        : `A comet is out, ${dir}. Faint, but real, and worth binoculars.`,
      when: null,
      direction: dir,
      azimuth: hor.azimuth,
      altitude: hor.altitude,
      magnitude: pos.mag,
      // a genuinely naked-eye comet is a once-every-few-years event
      rarity: pos.mag <= 3 ? 0.96 : nakedEye ? 0.88 : 0.72,
      score: 0,
      tag: `Magnitude ${pos.mag.toFixed(1)} · ${dir}`,
      detail:
        `This is a real comet, ${c.name}, a mountain of ancient ice falling through the inner solar system. Right now it sits ${pos.r.toFixed(2)} AU from the sun and ${pos.delta.toFixed(2)} AU from you. ` +
        (nakedEye
          ? `Find a dark spot, look ${dir}, and give your eyes time. You may catch a faint fuzzy star with a hint of a tail.`
          : `You'll want binoculars and a dark sky. Look ${dir} for a small grey smudge, softer than the stars around it.`) +
        ` Comets don't come back for lifetimes, or ever. This light left it about ${Math.round((pos.delta / LIGHT_AU_PER_DAY) * 24 * 60)} minutes ago.`,
    });
  }
  return out;
}
