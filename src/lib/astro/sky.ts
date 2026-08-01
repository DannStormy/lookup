// The assembler. Given a place and a moment, gather every reason to look up
// tonight, rank them, and hand back the one that matters most first.
import { observerOf, nightWindow, sunAltitude } from "./core";
import { moonEvent, moonIlluminationFraction } from "./moon";
import { planetEvents } from "./planets";
import { conjunctionEvents } from "./conjunctions";
import { meteorEvent, nextShowerAfter } from "./meteors";
import { auroraEvent } from "./aurora";
import { cometEvents } from "./comets";
import { getIssTle } from "./tle";
import { computePasses, issEvents } from "./iss";
import { findTransits, transitEvents } from "./transits";
import { starlinkEvents } from "./starlink";
import type { Place, SkyEvent, SkyReport } from "./types";

function rankScore(e: SkyEvent, now: number): number {
  let s = e.rarity;
  if (e.when) {
    const min = (Date.parse(e.when) - now) / 60000;
    if (min >= -3 && min <= 30) s += 0.34; // happening now, or minutes away
    else if (min > 30 && min <= 120) s += 0.18;
    else if (min > 120 && min <= 720) s += 0.06; // later tonight
    if (min < -3) s -= 0.6; // already peaked; push down
  } else {
    s += 0.04; // available all through the dark hours
  }
  if (e.magnitude != null) s += Math.max(0, -e.magnitude) * 0.008; // brighter = nudge up
  if (e.altitude != null) s += (e.altitude / 90) * 0.03; // higher = easier
  return s;
}

export async function computeSky(place: Place, date = new Date()): Promise<SkyReport> {
  const obs = observerOf(place);
  const now = date.getTime();

  const night = nightWindow(date, obs, -12);
  const darkNow = sunAltitude(date, obs) < -12;
  // A representative dark moment to evaluate "all night" sights.
  const darkRef: Date | null = darkNow ? date : night.dusk;
  // Does the sky get properly dark at all in the next day? (No, near the
  // summer poles: the midnight sun / white nights.)
  const hasDarkness = darkNow || night.dusk != null;

  const events: SkyEvent[] = [];

  // ISS passes + the rare transits of the moon/sun. Fetch TLE, scan 48h.
  try {
    const tle = await getIssTle();
    const passes = computePasses(tle.line1, tle.line2, place, date, 48);
    const transits = transitEvents(findTransits(tle.line1, tle.line2, place, date, 48));
    events.push(...transits);
    // If a pass contains a transit, the transit is the story; drop the plain pass.
    const transitWindows = transits.map((t) => ({
      s: Date.parse(t.windowStart!) - 120000,
      e: Date.parse(t.windowEnd!) + 120000,
    }));
    const passEvents = issEvents(passes).filter((p) => {
      const peak = p.when ? Date.parse(p.when) : NaN;
      return !transitWindows.some((w) => peak >= w.s && peak <= w.e);
    });
    events.push(...passEvents);
  } catch {
    // engine stays alive without ISS
  }

  // A freshly launched Starlink train, if one is passing over these nights.
  try {
    events.push(...(await starlinkEvents(place, date)));
  } catch {
    /* bonus phenomenon; never break the sky */
  }

  // Aurora (live NOAA data) only matters if it actually gets dark.
  if (hasDarkness) {
    try {
      const aurora = await auroraEvent(place);
      if (aurora) events.push(aurora);
    } catch {
      /* no-op */
    }
  }

  // Sky objects need a dark moment to be worth pointing at.
  if (darkRef) {
    const moon = moonEvent(darkRef, obs, night.dusk ?? darkRef);
    if (moon) events.push(moon);
    events.push(...planetEvents(darkRef, obs));
    events.push(...conjunctionEvents(darkRef, obs));
    const meteor = meteorEvent(darkRef, obs);
    if (meteor) events.push(meteor);
    try {
      events.push(...(await cometEvents(darkRef, obs, place)));
    } catch {
      /* comets are a bonus; never let them break the sky */
    }
  }

  // If a planet is also part of a conjunction, let the pairing carry it.
  const conjunctionBodies = new Set<string>();
  for (const e of events) {
    if (e.kind === "conjunction") {
      e.title
        .toLowerCase()
        .split(" and ")
        .forEach((n) => conjunctionBodies.add(n.trim().replace("the ", "")));
    }
  }
  const filtered = events.filter(
    (e) => !(e.kind === "planet" && conjunctionBodies.has(e.title.toLowerCase())),
  );

  // Near the summer poles the sky never darkens. Say so, gently, so it's
  // never a blank screen.
  if (!hasDarkness && filtered.length === 0) {
    const polar = Math.abs(place.lat) > 55;
    filtered.push({
      id: "white-nights",
      kind: "moon",
      title: polar ? "White nights" : "A short, bright night",
      subtitle: polar
        ? "The sun won't dip far enough tonight. The sky stays lit until dawn."
        : "The sky barely darkens tonight this far into summer.",
      when: null,
      rarity: 0.4,
      score: 1,
      tag: "Midnight sun",
      detail:
        "This far into summer, the sun skims just below the horizon and the sky holds a deep blue glow all night. The stars, the station, the meteors, they're all still up there, just outshone. Come back in a few weeks and the dark will return, and with it everything in it.",
    });
  }

  for (const e of filtered) e.score = rankScore(e, now);
  filtered.sort((a, b) => b.score - a.score);

  // The forward hook: the next genuinely special night on the horizon, so a
  // quiet sky is never the last word.
  let comingUp: SkyReport["comingUp"] = null;
  const shower = nextShowerAfter(date);
  if (shower) {
    const nights = shower.daysAway;
    comingUp = {
      title: `The ${shower.name} peak`,
      when: shower.peakIso,
      note:
        nights <= 1
          ? `Tomorrow night, up to ${shower.zhr} meteors an hour: ${shower.blurb}.`
          : `In ${nights} nights, up to ${shower.zhr} meteors an hour: ${shower.blurb}.`,
    };
  }

  return {
    place,
    generatedAt: date.toISOString(),
    night: {
      dusk: night.dusk?.toISOString() ?? null,
      dawn: night.dawn?.toISOString() ?? null,
    },
    darkNow,
    moonIllumination: moonIlluminationFraction(date),
    events: filtered.slice(0, 8),
    comingUp,
  };
}
