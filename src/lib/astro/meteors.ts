import { Body, Observer } from "astronomy-engine";
import { altAz, altAzRaDec, lookPhrase, sunAltitude } from "./core";
import { moonIlluminationFraction } from "./moon";
import type { SkyEvent } from "./types";

// Major annual showers. Radiant RA (hours) / Dec (deg) are effectively constant;
// peak nights drift ~a day year to year. Sourced from IMO/AMS 2026 calendar.
export interface Shower {
  key: string;
  name: string;
  peakMonth: number; // 1-12
  peakDay: number; // day of the peak night (local evening)
  zhr: number;
  raHours: number;
  decDeg: number;
  blurb: string;
  parent: string;
  speedKms: number;
  active: string;
}

export const SHOWERS: Shower[] = [
  { key: "quadrantids", name: "Quadrantids", peakMonth: 1, peakDay: 3, zhr: 120, raHours: 15.33, decDeg: 49, blurb: "a brief, sharp peak of blue meteors", parent: "asteroid 2003 EH1", speedKms: 41, active: "late December to mid January" },
  { key: "lyrids", name: "Lyrids", peakMonth: 4, peakDay: 22, zhr: 18, raHours: 18.07, decDeg: 34, blurb: "fast meteors, the occasional bright fireball", parent: "comet Thatcher (C/1861 G1)", speedKms: 49, active: "mid to late April" },
  { key: "eta-aquariids", name: "Eta Aquariids", peakMonth: 5, peakDay: 5, zhr: 50, raHours: 22.53, decDeg: -1, blurb: "swift, glancing meteors from Halley's Comet", parent: "Halley's Comet (1P/Halley)", speedKms: 66, active: "late April to late May" },
  { key: "perseids", name: "Perseids", peakMonth: 8, peakDay: 12, zhr: 100, raHours: 3.2, decDeg: 58, blurb: "the year's most beloved shower, warm nights and long trails", parent: "comet Swift-Tuttle (109P)", speedKms: 59, active: "mid July to late August" },
  { key: "orionids", name: "Orionids", peakMonth: 10, peakDay: 21, zhr: 20, raHours: 6.33, decDeg: 16, blurb: "fast, faint meteors, also debris from Halley's Comet", parent: "Halley's Comet (1P/Halley)", speedKms: 66, active: "early October to early November" },
  { key: "leonids", name: "Leonids", peakMonth: 11, peakDay: 16, zhr: 15, raHours: 10.13, decDeg: 22, blurb: "quick meteors capable of rare, dramatic storms", parent: "comet Tempel-Tuttle (55P)", speedKms: 71, active: "most of November" },
  { key: "geminids", name: "Geminids", peakMonth: 12, peakDay: 13, zhr: 150, raHours: 7.47, decDeg: 33, blurb: "the richest shower of the year, slow and often coloured", parent: "asteroid 3200 Phaethon", speedKms: 35, active: "early to mid December" },
];

/** Meteors per hour a dark-sky observer could count, before any off-peak penalty. */
export function estimatedRate(
  zhr: number,
  radiantAltitude: number,
  moonUp: boolean,
  moonLit: number,
): number {
  if (radiantAltitude <= 0) return 0;
  const radiantFactor = Math.sin((radiantAltitude * Math.PI) / 180);
  return zhr * radiantFactor * (moonUp ? 1 - moonLit * 0.7 : 1);
}

export interface UpcomingShower {
  name: string;
  peakIso: string;
  daysAway: number;
  zhr: number;
  blurb: string;
}

/** The next shower peak strictly after `date`, for the "coming up" hook. */
export function nextShowerAfter(date: Date): UpcomingShower | null {
  const y = date.getUTCFullYear();
  let best: UpcomingShower | null = null;
  for (const s of SHOWERS) {
    // this year's peak, and next year's, pick the next one still ahead
    for (const year of [y, y + 1]) {
      const peak = new Date(Date.UTC(year, s.peakMonth - 1, s.peakDay, 2, 0, 0));
      const daysAway = (peak.getTime() - date.getTime()) / 86400000;
      if (daysAway <= 0.4) continue; // already tonight/past; handled elsewhere
      if (!best || daysAway < best.daysAway) {
        best = {
          name: s.name,
          peakIso: peak.toISOString(),
          daysAway: Math.round(daysAway),
          zhr: s.zhr,
          blurb: s.blurb,
        };
      }
      break; // first valid (this-year) wins for this shower
    }
  }
  return best;
}

/** Which shower, if any, is near peak tonight (within +/- 2 nights). */
function activeShower(date: Date): { shower: Shower; nightsFromPeak: number } | null {
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  let best: { shower: Shower; nightsFromPeak: number } | null = null;
  for (const s of SHOWERS) {
    if (s.peakMonth !== m) continue;
    const diff = Math.abs(d - s.peakDay);
    if (diff <= 2 && (!best || diff < Math.abs(best.nightsFromPeak))) {
      best = { shower: s, nightsFromPeak: d - s.peakDay };
    }
  }
  return best;
}

export function meteorEvent(when: Date, obs: Observer): SkyEvent | null {
  const active = activeShower(when);
  if (!active) return null;
  const { shower, nightsFromPeak } = active;

  const radiant = altAzRaDec(shower.raHours, shower.decDeg, when, obs);
  // If the radiant is below the horizon at the dark hour, you'll see almost none.
  if (radiant.altitude < 5) return null;

  const moonLit = moonIlluminationFraction(when);
  const moonUp = altAz(Body.Moon, when, obs).altitude > 0;
  const dark = sunAltitude(when, obs) < -12;
  if (!dark) return null;

  // Observed rate scales with radiant altitude; moonlight and off-peak nights cut it.
  const peakPenalty = 1 - Math.abs(nightsFromPeak) * 0.25;
  const estRate = Math.round(
    estimatedRate(shower.zhr, radiant.altitude, moonUp, moonLit) * peakPenalty,
  );

  const onPeak = nightsFromPeak === 0;
  const dir = lookPhrase(radiant.altitude, radiant.azimuth);

  return {
    id: `meteor-${shower.key}`,
    kind: "meteor",
    title: `${shower.name} meteors`,
    subtitle: onPeak
      ? `Tonight is the peak of the ${shower.name}, ${shower.blurb}.`
      : `The ${shower.name} are near peak, ${shower.blurb}.`,
    when: null,
    direction: dir,
    azimuth: radiant.azimuth,
    altitude: radiant.altitude,
    // A rich, moon-free shower peak is one of the best free shows in nature.
    rarity: onPeak ? 0.78 : 0.6,
    score: 0,
    tag: `Up to ~${Math.max(3, estRate)}/hr · radiant ${dir}`,
    detail: `You don't look at the radiant, you look near it. The meteors streak away from a point ${dir}, so face that way but let your gaze go wide and soft. Give your eyes twenty minutes to adjust and put your phone away; the faint ones only appear once you stop staring at a screen. ${moonUp && moonLit > 0.4 ? "The moon is up and will drown the fainter meteors tonight, so you'll catch the brightest." : "The moon won't interfere much, so even the faint ones should come through."} No equipment; the whole sky is the show.`,
  };
}
