import { Body, Illumination, MoonPhase, Observer } from "astronomy-engine";
import { riseSet, altAz, lookPhrase } from "./core";
import type { SkyEvent } from "./types";

const PHASE_NAMES = [
  { max: 10, name: "new moon", waxing: true },
  { max: 80, name: "waxing crescent", waxing: true },
  { max: 100, name: "first quarter", waxing: true },
  { max: 170, name: "waxing gibbous", waxing: true },
  { max: 190, name: "full moon", waxing: true },
  { max: 260, name: "waning gibbous", waxing: false },
  { max: 280, name: "last quarter", waxing: false },
  { max: 350, name: "waning crescent", waxing: false },
  { max: 361, name: "new moon", waxing: false },
];

function phaseName(phaseDeg: number): string {
  return PHASE_NAMES.find((p) => phaseDeg < p.max)!.name;
}

/** 0..1 fraction of the moon's disk lit right now. */
export function moonIlluminationFraction(date: Date): number {
  return Illumination(Body.Moon, date).phase_fraction;
}

export function moonEvent(
  date: Date,
  obs: Observer,
  nightStart: Date,
): SkyEvent | null {
  const phase = MoonPhase(date);
  const illum = moonIlluminationFraction(date);
  const name = phaseName(phase);
  const { rise, set } = riseSet(Body.Moon, obs, nightStart);
  const pct = Math.round(illum * 100);

  // Is the moon actually up during tonight's darkness?
  const moonPos = altAz(Body.Moon, nightStart, obs);
  const nowAlt = moonPos.altitude;
  const up = nowAlt > 0;

  let subtitle: string;
  let detail: string;
  if (name === "full moon") {
    subtitle = "The moon is full tonight, and it owns the sky.";
    detail =
      "A full moon washes out the faintest stars, but it is its own event. Watch it clear the horizon, huge and amber, then shrink and silver as it climbs.";
  } else if (name === "new moon") {
    subtitle = "No moon tonight. The dark is as deep as it gets.";
    detail =
      "With the moon gone, the sky is at its blackest. This is the best kind of night for faint things: the Milky Way, meteors, distant planets.";
  } else if (illum < 0.35) {
    subtitle = `A thin ${name}, ${pct}% lit, and a dark, generous sky.`;
    detail =
      "A slim crescent leaves the sky dark enough for almost anything. Look for earthshine, the ghostly grey glow filling the unlit part of the disk.";
  } else {
    subtitle = `A ${name}, ${pct}% lit.`;
    const waxing = phase < 180;
    const terminator = ` That sharp line splitting its light from its dark, the terminator, is where the sun is ${waxing ? "rising" : "setting"} on the moon right now. You're watching a lunar ${waxing ? "sunrise" : "sunset"} in slow motion.`;
    detail =
      (up
        ? "Bright enough to cast a shadow, and beautiful in its own right."
        : "It rises later tonight, so the early hours stay dark and clear.") +
      terminator;
  }

  const when = up ? null : rise ? rise.toISOString() : null;
  const dir = up ? lookPhrase(nowAlt, moonPos.azimuth) : "the eastern horizon";

  // The moon is rarely "the" event, but a full or new moon matters more.
  const rarity = name === "full moon" || name === "new moon" ? 0.35 : 0.15;

  return {
    id: "moon",
    kind: "moon",
    title: "The moon",
    subtitle,
    when,
    windowStart: rise?.toISOString(),
    windowEnd: set?.toISOString(),
    direction: dir,
    azimuth: up ? moonPos.azimuth : undefined,
    altitude: up ? nowAlt : undefined,
    magnitude: -12.5,
    rarity,
    score: 0, // set by ranker
    tag: `${name[0].toUpperCase()}${name.slice(1)}, ${pct}%`,
    detail,
  };
}
