import { Body, Illumination, Observer } from "astronomy-engine";
import { altAz, lookPhrase, riseSet } from "./core";
import type { SkyEvent } from "./types";

const NAKED_EYE = [
  { body: Body.Venus, name: "Venus", note: "the brightest thing in the sky after the moon" },
  { body: Body.Jupiter, name: "Jupiter", note: "steady, creamy white, unmistakable" },
  { body: Body.Saturn, name: "Saturn", note: "a soft gold; its rings need a small telescope" },
  { body: Body.Mars, name: "Mars", note: "a distinct rusty red" },
  { body: Body.Mercury, name: "Mercury", note: "shy, low, only out for a short while after sunset" },
] as const;

/**
 * Which bright planets are up and worth pointing out during tonight's darkness.
 * Evaluated at `when` (a dark moment). Returns one event per visible planet.
 */
export function planetEvents(when: Date, obs: Observer): SkyEvent[] {
  const out: SkyEvent[] = [];
  for (const p of NAKED_EYE) {
    const pos = altAz(p.body, when, obs);
    if (pos.altitude < 8) continue; // too low to see through the murk
    const illum = Illumination(p.body, when);
    const mag = illum.mag;
    // Mercury and a faint Mars near conjunction aren't worth a callout.
    if (p.body === Body.Mercury && pos.altitude < 6) continue;

    const { set } = riseSet(p.body, obs, when);
    const dir = lookPhrase(pos.altitude, pos.azimuth);
    const bright = mag < -3;
    // light-travel time: the view you're seeing is this many minutes old
    const lightMin = Math.round(illum.geo_dist * 8.317);

    out.push({
      id: `planet-${p.name.toLowerCase()}`,
      kind: "planet",
      title: p.name,
      subtitle: `${p.name} is out, ${dir}. ${cap(p.note)}.`,
      when: null,
      windowEnd: set?.toISOString(),
      direction: dir,
      azimuth: pos.azimuth,
      altitude: pos.altitude,
      magnitude: mag,
      // Venus/Jupiter blaze; the rarity of "just a planet" is modest.
      rarity: bright ? 0.28 : 0.2,
      score: 0,
      tag: `Magnitude ${mag.toFixed(1)}${set ? `, sets ${fmtLocalHint(set)}` : ""}`,
      detail: planetDetail(p.name, dir, lightMin),
    });
  }
  return out;
}

function planetDetail(name: string, dir: string, lightMin: number): string {
  const travel =
    lightMin >= 1
      ? ` The light reaching your eye left ${name} about ${lightMin} minute${lightMin === 1 ? "" : "s"} ago.`
      : "";
  return `Find ${name} ${dir}. No telescope needed, just your eyes; planets don't twinkle the way stars do, they hold a steady, unwavering light.${travel}`;
}

function cap(s: string): string {
  return s[0].toUpperCase() + s.slice(1);
}

// A soft hint only; the client renders precise local times.
function fmtLocalHint(_d: Date): string {
  return "later";
}
