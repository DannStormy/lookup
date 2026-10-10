import { lookPhrase } from "./astro/core";
import type { Shower } from "./astro/meteors";
import type { ShowerForecast } from "./astro/shower-forecast";
import type { City } from "./cities";
import { dateIn, timeIn } from "./format";

/** "Geminids" -> "Geminid", for "the Geminid meteor shower". */
export function singular(shower: Shower): string {
  return shower.name.replace(/s$/, "");
}

export function peakNight(peakNoon: Date, tz = "UTC"): string {
  return dateIn(peakNoon.toISOString(), tz);
}

export function summaryLine(shower: Shower, city: City, f: ShowerForecast, night: string): string {
  const opening = `The ${shower.name} peak on the night of ${night}`;
  if (!f.dusk) {
    return `${opening}, but the sky over ${city.name} does not get dark that night, so the shower will not be visible.`;
  }
  if (!f.visible || !f.best) {
    return `${opening}, but the radiant barely clears the horizon from ${city.name}, so few meteors, if any, will be visible.`;
  }
  return `${opening}. From ${city.name} the best time to watch is ${bestTime(f, city.tz, "sentence")}, when the radiant is ${lookPhrase(f.best.altitude, f.best.azimuth)}. Under a dark sky that means up to about ${f.best.rate} meteors an hour. From inside the city you will see far fewer.`;
}

// A radiant still climbing at dawn peaks on the last sample; "3 minutes before dawn" helps nobody.
export function bestTime(f: ShowerForecast, tz: string, form: "sentence" | "label"): string {
  if (!f.best) return "";
  const untilDawn = f.dawn ? Date.parse(f.dawn) - Date.parse(f.best.at) : Infinity;
  if (f.dawn && untilDawn < 45 * 60 * 1000) {
    const dawn = timeIn(f.dawn, tz);
    return form === "sentence"
      ? `the last dark hour, before about ${dawn}`
      : `The last hour before ${dawn}`;
  }
  const at = timeIn(f.best.at, tz);
  return form === "sentence" ? `around ${at}` : at;
}

export function radiantLine(f: ShowerForecast, tz: string): string {
  if (f.radiant.upAtDusk) return "Already up at dusk";
  if (f.radiant.rises) return timeIn(f.radiant.rises, tz);
  return "Does not rise";
}

export function moonLine(f: ShowerForecast, tz: string): string {
  const pct = Math.round(f.moon.lit * 100);
  const at = f.moon.at ? timeIn(f.moon.at, tz) : "";
  switch (f.moon.state) {
    case "down":
      return `${pct}% lit and below the horizon all night`;
    case "up":
      return pct >= 35
        ? `${pct}% lit and up all night, which hides the fainter meteors`
        : `${pct}% lit and up all night`;
    case "sets":
      return `${pct}% lit, sets around ${at}`;
    case "rises":
      return `${pct}% lit, rises around ${at}`;
  }
}

export function aboutLine(shower: Shower): string {
  return `The ${shower.name} are active from ${shower.active}. The meteors are debris from ${shower.parent} and hit the atmosphere at about ${shower.speedKms} km per second. At the peak, a perfectly dark sky with the radiant overhead would show about ${shower.zhr} an hour. Real counts are lower.`;
}
