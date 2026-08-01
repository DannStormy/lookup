// The rarest, most precise thing this app can tell you: the exact second the
// space station will cross the face of the Moon or the Sun, from your exact
// spot. The transit path is only a few km wide, so most places see none for
// months. When there is one, it's a one-second silhouette.

import * as sat from "satellite.js";
import { Body, Equator } from "astronomy-engine";
import { observerOf, altAz, lookPhrase } from "./core";
import type { Place, SkyEvent } from "./types";

const DEG = 180 / Math.PI;
const AU_KM = 149597870.7;
const MOON_RADIUS_KM = 1737.4;
const SUN_RADIUS_KM = 696000;

interface Look {
  el: number; // deg
  az: number; // deg
}

function issLook(
  satrec: sat.SatRec,
  obsGd: sat.GeodeticLocation,
  t: Date,
): Look | null {
  let pv;
  try {
    pv = sat.propagate(satrec, t);
  } catch {
    return null;
  }
  if (!pv || !pv.position || typeof pv.position === "boolean") return null;
  const gmst = sat.gstime(t);
  const ecf = sat.eciToEcf(pv.position, gmst);
  const look = sat.ecfToLookAngles(obsGd, ecf);
  return { el: look.elevation * DEG, az: ((look.azimuth * DEG) % 360 + 360) % 360 };
}

/** Angular separation (deg) between two alt/az directions. */
function angSep(a1: Look, a2: Look): number {
  const alt1 = a1.el / DEG,
    alt2 = a2.el / DEG,
    dAz = (a1.az - a2.az) / DEG;
  const c =
    Math.sin(alt1) * Math.sin(alt2) +
    Math.cos(alt1) * Math.cos(alt2) * Math.cos(dAz);
  return Math.acos(Math.max(-1, Math.min(1, c))) * DEG;
}

interface TransitHit {
  body: Body;
  center: Date;
  durationSec: number;
  el: number;
  az: number;
}

/** alt/az + angular radius (deg) of the Moon or Sun, right now, from here. */
function discOf(body: Body, t: Date, obs: ReturnType<typeof observerOf>) {
  const eq = Equator(body, t, obs, true, true);
  const pos = altAz(body, t, obs);
  const distKm = eq.dist * AU_KM;
  const r = body === Body.Moon ? MOON_RADIUS_KM : SUN_RADIUS_KM;
  const angRadius = Math.asin(Math.min(1, r / distKm)) * DEG;
  return { look: { el: pos.altitude, az: pos.azimuth }, angRadius };
}

export function findTransits(
  tleLine1: string,
  tleLine2: string,
  place: Place,
  from: Date,
  hours = 48,
  // test-only: inflate the lunar/solar disc to validate the detection pipeline
  radiusScale = 1,
): TransitHit[] {
  const satrec = sat.twoline2satrec(tleLine1, tleLine2);
  const obs = observerOf(place);
  const obsGd: sat.GeodeticLocation = {
    longitude: sat.degreesToRadians(place.lon),
    latitude: sat.degreesToRadians(place.lat),
    height: (place.elevation ?? 0) / 1000,
  };

  const bodies = [Body.Moon, Body.Sun];

  // 1. Coarse 30s scan. Within each above-horizon window, track the closest the
  //    ISS gets to each disc (and when), so we fine-scan the right instant.
  interface Approach {
    minSep: number;
    at: Date;
  }
  interface Window {
    approach: Map<Body, Approach>;
  }
  const windows: Window[] = [];
  let cur: Window | null = null;
  const stepSec = 30;
  const steps = Math.floor((hours * 3600) / stepSec);
  for (let i = 0; i <= steps; i++) {
    const t = new Date(from.getTime() + i * stepSec * 1000);
    const look = issLook(satrec, obsGd, t);
    const up = look != null && look.el > 0;
    if (up) {
      if (!cur) cur = { approach: new Map() };
      for (const body of bodies) {
        const disc = discOf(body, t, obs);
        if (disc.look.el < 0) continue;
        const sep = angSep(look, disc.look);
        const a = cur.approach.get(body);
        if (!a || sep < a.minSep) cur.approach.set(body, { minSep: sep, at: t });
      }
    } else if (cur) {
      windows.push(cur);
      cur = null;
    }
  }
  if (cur) windows.push(cur);

  const hits: TransitHit[] = [];

  for (const w of windows) {
    for (const body of bodies) {
      const a = w.approach.get(body);
      // the true minimum between 30s samples can be ~15deg under the sampled
      // one (the ISS moves ~1deg/s), so investigate anything reasonably close
      if (!a || a.minSep > 15) continue;

      // 2. Fine 0.5s scan in the +/-60s around the coarse closest approach.
      let best: { t: Date; sep: number; angRadius: number } | null = null;
      for (let dt = -60; dt <= 60; dt += 0.5) {
        const t = new Date(a.at.getTime() + dt * 1000);
        const iss = issLook(satrec, obsGd, t);
        if (!iss || iss.el <= 0) continue;
        const disc = discOf(body, t, obs);
        if (disc.look.el < 0) continue;
        const sep = angSep(iss, disc.look);
        if (!best || sep < best.sep) best = { t, sep, angRadius: disc.angRadius };
      }
      if (!best) continue;
      const scaledRadius = best.angRadius * radiusScale;
      // the 0.5s scan can step over a sub-degree minimum, so don't reject on it;
      // let the 0.02s refine be the arbiter whenever we're plausibly close.
      if (best.sep > Math.max(2, scaledRadius)) continue;

      // 3. Refine the exact center + how long the ISS is within the disc.
      const refined = refine(satrec, obsGd, obs, body, best.t, scaledRadius);
      if (refined) hits.push(refined);
    }
  }

  // de-dup (a transit can be caught in overlapping checks) and sort by time
  const seen = new Set<number>();
  return hits
    .filter((h) => {
      const k = Math.round(h.center.getTime() / 1000);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => a.center.getTime() - b.center.getTime());
}

function refine(
  satrec: sat.SatRec,
  obsGd: sat.GeodeticLocation,
  obs: ReturnType<typeof observerOf>,
  body: Body,
  around: Date,
  angRadius: number,
): TransitHit | null {
  // sample +/- 2s at 0.02s to locate the minimum and the in-disc duration
  const fine = 0.02;
  let minSep = Infinity;
  let minT = around;
  let minLook: Look | null = null;
  let inDisc = 0;
  for (let dt = -2; dt <= 2; dt += fine) {
    const t = new Date(around.getTime() + dt * 1000);
    const iss = issLook(satrec, obsGd, t);
    if (!iss || iss.el <= 0) continue;
    const disc = discOf(body, t, obs);
    const sep = angSep(iss, disc.look);
    if (sep <= angRadius) inDisc += fine;
    if (sep < minSep) {
      minSep = sep;
      minT = t;
      minLook = { el: disc.look.el, az: disc.look.az };
    }
  }
  if (minSep > angRadius || !minLook) return null;
  return {
    body,
    center: minT,
    durationSec: Math.max(0.3, Math.round(inDisc * 10) / 10),
    el: minLook.el,
    az: minLook.az,
  };
}

export function transitEvents(hits: TransitHit[]): SkyEvent[] {
  return hits.map((h) => {
    const moon = h.body === Body.Moon;
    const dir = lookPhrase(h.el, h.az);
    const secs = h.durationSec.toFixed(1);
    return {
      id: `transit-${moon ? "moon" : "sun"}-${Math.round(h.center.getTime() / 1000)}`,
      kind: "iss",
      title: moon ? "The station crosses the moon" : "The station crosses the sun",
      subtitle: moon
        ? `For about a second, the space station passes in silhouette across the face of the moon, ${dir}.`
        : `The space station crosses the face of the sun in silhouette, ${dir}.`,
      when: h.center.toISOString(),
      windowStart: new Date(h.center.getTime() - 1500).toISOString(),
      windowEnd: new Date(h.center.getTime() + 1500).toISOString(),
      direction: dir,
      azimuth: h.az,
      altitude: h.el,
      // the rarest thing here: a transit visible from your exact spot
      rarity: moon ? 0.97 : 0.95,
      score: 0,
      tag: `Lasts about ${secs} seconds`,
      detail: moon
        ? `This is the precision game at its most absurd. For about ${secs} seconds, at the exact second shown, the space station will cross directly in front of the moon as seen from where you're standing, a tiny dark shape sliding over the craters. The path where this is visible is only a few kilometres wide, so almost nobody else will see it. Point binoculars or a phone at the moon a minute early and watch. Blink and it's gone.`
        : `A silhouette transit of the sun. WARNING: never look at the sun, or point an unfiltered camera or binoculars at it. With a certified solar filter only, at the exact second shown, the space station will cross the sun's disc for about ${secs} seconds as a sharp black shape. The visible path is only a few kilometres wide. Without a proper solar filter, do not attempt this one.`,
    };
  });
}
