import { Body, GeoVector, AngleBetween, Observer } from "astronomy-engine";
import { altAz, lookPhrase } from "./core";
import type { SkyEvent } from "./types";

// Pairs worth watching. Bright + slow-moving enough to make a real "meeting".
const PAIRS: { a: Body; b: Body; an: string; bn: string }[] = [
  { a: Body.Moon, b: Body.Venus, an: "The moon", bn: "Venus" },
  { a: Body.Moon, b: Body.Jupiter, an: "The moon", bn: "Jupiter" },
  { a: Body.Moon, b: Body.Mars, an: "The moon", bn: "Mars" },
  { a: Body.Moon, b: Body.Saturn, an: "The moon", bn: "Saturn" },
  { a: Body.Venus, b: Body.Jupiter, an: "Venus", bn: "Jupiter" },
  { a: Body.Venus, b: Body.Mars, an: "Venus", bn: "Mars" },
  { a: Body.Venus, b: Body.Saturn, an: "Venus", bn: "Saturn" },
  { a: Body.Jupiter, b: Body.Mars, an: "Jupiter", bn: "Mars" },
  { a: Body.Jupiter, b: Body.Saturn, an: "Jupiter", bn: "Saturn" },
  { a: Body.Mars, b: Body.Saturn, an: "Mars", bn: "Saturn" },
];

function separationDeg(a: Body, b: Body, date: Date): number {
  const va = GeoVector(a, date, true);
  const vb = GeoVector(b, date, true);
  return AngleBetween(va, vb);
}

/**
 * Two bodies within a few degrees of each other and both up during darkness
 * is a genuinely lovely, uncommon sight. Evaluated at a dark moment `when`.
 */
export function conjunctionEvents(when: Date, obs: Observer): SkyEvent[] {
  const out: SkyEvent[] = [];
  for (const pair of PAIRS) {
    const sep = separationDeg(pair.a, pair.b, when);
    if (sep > 5) continue; // not close enough to feel like a pairing

    const posA = altAz(pair.a, when, obs);
    const posB = altAz(pair.b, when, obs);
    // Both need to be above the horizon to actually witness it.
    if (posA.altitude < 5 || posB.altitude < 5) continue;

    const midAlt = (posA.altitude + posB.altitude) / 2;
    const midAz = (posA.azimuth + posB.azimuth) / 2;
    const dir = lookPhrase(midAlt, midAz);
    const closeness = sep < 1 ? "almost touching" : sep < 2.5 ? "a finger-width apart" : "close together";
    // Closer pairings are rarer and more striking.
    const rarity = sep < 1 ? 0.82 : sep < 2.5 ? 0.68 : 0.55;

    out.push({
      id: `conj-${pair.an}-${pair.bn}`.toLowerCase().replace(/\s+/g, "-"),
      kind: "conjunction",
      title: `${pair.an} and ${pair.bn}`,
      subtitle: `${pair.an} and ${pair.bn} are ${closeness} tonight, ${dir}.`,
      when: null,
      direction: dir,
      azimuth: midAz,
      altitude: midAlt,
      rarity,
      score: 0,
      tag: `${sep.toFixed(1)}° apart`,
      detail: `Two of the brightest lights in the sky have drifted into the same small patch, only ${sep.toFixed(1)} degrees apart. Look ${dir}. Pairings this close happen only a handful of times a year, and they never look staged; they look like a coincidence you happened to catch.`,
    });
  }
  return out;
}
