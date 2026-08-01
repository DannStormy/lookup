// Aurora likelihood from live NOAA SWPC data. Two signals:
//  - OVATION nowcast grid: % chance of visible aurora overhead, right now.
//  - Kp forecast: drives how far from the poles the aurora reaches tonight.
// Aurora sits at a fixed *geomagnetic* latitude, so we convert from geographic.

import type { Place, SkyEvent } from "./types";

const OVATION_URL =
  "https://services.swpc.noaa.gov/json/ovation_aurora_latest.json";
const KP_FORECAST_URL =
  "https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json";

interface OvationGrid {
  ObservationTime?: string;
  ForecastTime?: string;
  coordinates: [number, number, number][]; // [lon 0..359, lat -90..90, prob 0..100]
}

interface Cached<T> {
  data: T;
  at: number;
}
let ovationCache: Cached<OvationGrid> | null = null;
let kpCache: Cached<number> | null = null;
const TTL = 10 * 60 * 1000; // 10 min

// Offset dipole north pole (approx, 2025 epoch): ~80.7N, 72.7W.
const POLE_LAT = (80.7 * Math.PI) / 180;
const POLE_LON = (-72.7 * Math.PI) / 180;

/** Geomagnetic latitude (deg) via a centered-dipole transform. */
function geomagneticLat(latDeg: number, lonDeg: number): number {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  const sinMagLat =
    Math.sin(lat) * Math.sin(POLE_LAT) +
    Math.cos(lat) * Math.cos(POLE_LAT) * Math.cos(lon - POLE_LON);
  return (Math.asin(Math.max(-1, Math.min(1, sinMagLat))) * 180) / Math.PI;
}

/** Equatorward edge of visible aurora (geomagnetic deg) for a given Kp. */
function auroraEdgeGeomagLat(kp: number): number {
  // Rough rule of thumb: Kp0 ~66, Kp3 ~59, Kp5 ~56, Kp7 ~52, Kp9 ~48.
  return 66.5 - kp * 2;
}

async function getOvation(): Promise<OvationGrid | null> {
  if (ovationCache && Date.now() - ovationCache.at < TTL) return ovationCache.data;
  try {
    const res = await fetch(OVATION_URL, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`ovation ${res.status}`);
    const data = (await res.json()) as OvationGrid;
    ovationCache = { data, at: Date.now() };
    return data;
  } catch {
    return ovationCache?.data ?? null;
  }
}

async function getMaxKpNext24h(): Promise<number | null> {
  if (kpCache && Date.now() - kpCache.at < TTL) return kpCache.data;
  try {
    const res = await fetch(KP_FORECAST_URL, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`kp ${res.status}`);
    const rows = (await res.json()) as [string, string, string, string][];
    // First row is a header. Columns: time_tag, kp, observed, noaa_scale.
    const now = Date.now();
    let maxKp = 0;
    for (const r of rows.slice(1)) {
      const t = Date.parse(r[0] + "Z");
      const kp = parseFloat(r[1]);
      if (!isFinite(t) || !isFinite(kp)) continue;
      if (t >= now && t <= now + 24 * 3600 * 1000) maxKp = Math.max(maxKp, kp);
    }
    kpCache = { data: maxKp, at: Date.now() };
    return maxKp;
  } catch {
    return kpCache?.data ?? null;
  }
}

/** Sample the nowcast grid near a point (nearest-degree lookup). */
function sampleOvation(grid: OvationGrid, lat: number, lon: number): number {
  const lon360 = ((lon % 360) + 360) % 360;
  const tLat = Math.round(lat);
  const tLon = Math.round(lon360);
  let best = 0;
  // Grid is dense (~1deg); scan for the closest matching cell.
  for (const [gl, ga, prob] of grid.coordinates) {
    if (Math.abs(ga - tLat) <= 1 && Math.abs(gl - tLon) <= 1) {
      best = Math.max(best, prob);
    }
  }
  return best;
}

export async function auroraEvent(place: Place): Promise<SkyEvent | null> {
  const [grid, maxKp] = await Promise.all([getOvation(), getMaxKpNext24h()]);

  const magLat = Math.abs(geomagneticLat(place.lat, place.lon));
  const nowcastProb = grid ? sampleOvation(grid, place.lat, place.lon) : 0;

  const kp = maxKp ?? 0;
  const edge = auroraEdgeGeomagLat(kp);
  const reachable = magLat >= edge; // aurora oval may dip to the user tonight
  const marginToEdge = magLat - edge; // positive = inside the likely zone

  // Only surface if there's a real chance: strong nowcast, or forecast reaches us.
  const worthShowing = nowcastProb >= 8 || (reachable && kp >= 4);
  if (!worthShowing) return null;

  const strong = nowcastProb >= 25 || marginToEdge > 4;
  const dir = place.lat >= 0 ? "the northern horizon" : "the southern horizon";

  const rarity = strong ? 0.95 : 0.85; // aurora is the rarest thing most people ever see

  const subtitle = strong
    ? `Aurora is likely tonight. Watch ${dir}.`
    : `There's a real chance of aurora tonight, low on ${dir}.`;

  const detail =
    `A geomagnetic storm is pushing the aurora toward you (Kp around ${kp.toFixed(0)}${nowcastProb >= 8 ? `, and the live nowcast puts the chance overhead near ${Math.round(nowcastProb)}%` : ""}). ` +
    `Get away from city lights, give the sky an hour after full dark, and look low toward ${dir}. ` +
    `To the eye it often reads as a pale grey-green glow or faint moving pillars; a phone camera on a few seconds of exposure will pull out the colour your eyes can't. This is the one on this list most people go a lifetime without seeing.`;

  return {
    id: "aurora",
    kind: "aurora",
    title: "The aurora",
    subtitle,
    when: null,
    direction: dir,
    rarity,
    score: 0,
    tag: `Kp ~${kp.toFixed(0)}${nowcastProb >= 8 ? ` · ~${Math.round(nowcastProb)}% overhead` : ""}`,
    detail,
  };
}
