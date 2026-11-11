import { latitudeProfile, type DayRange, type LatitudeProfile, type ObjectReach } from "./astro/latitude";
import type { City } from "./cities";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const deg = (n: number) => `${Math.round(n)}°`;
const day = ({ month, day }: DayRange["from"]) => `${MONTHS[month - 1]} ${day}`;

export function latitudeLabel(lat: number): string {
  return `${Math.abs(lat).toFixed(1)}° ${lat >= 0 ? "north" : "south"}`;
}

function list(items: ObjectReach[]): string {
  const names = items.map((o) => o.object.name);
  const joined = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0];
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}

const plural = (items: ObjectReach[]) => items.length > 1 || !!items[0]?.object.plural;

function poleLine(city: City, p: LatitudeProfile): string {
  const where = `From ${city.name}, at ${latitudeLabel(city.lat)}`;
  if (p.poleAltitude < 5) {
    return `${city.name} is ${latitudeLabel(city.lat)}, close enough to the equator that both celestial poles sit on the horizon. Over a year, nearly every star in the sky rises and sets here.`;
  }
  if (p.hemisphere === "north") {
    return `${where}, Polaris stands ${deg(p.poleAltitude)} above the northern horizon, the same as the latitude, and holds still while the rest of the sky turns around it.`;
  }
  return `${where}, Polaris never rises. The south celestial pole sits ${deg(p.poleAltitude)} above the southern horizon instead, in a dim patch of sky with no bright star to mark it.`;
}

function starLines(city: City, p: LatitudeProfile): string[] {
  const by = (r: ObjectReach["reach"]) => p.objects.filter((o) => o.reach === r);
  const lines: string[] = [];
  const up = by("circumpolar");
  if (up.length && p.poleAltitude >= 5) {
    lines.push(`${list(up)} never ${plural(up) ? "set" : "sets"} here, so on any clear night of the year ${plural(up) ? "they are" : "it is"} somewhere above the horizon.`);
  }
  const never = by("never");
  if (never.length) {
    const nearest = [...never].sort((a, b) => b.maxAltitude - a.maxAltitude)[0];
    const edge = p.hemisphere === "north" ? `south of about ${deg(90 + nearest.object.dec)} north` : `north of about ${deg(90 - nearest.object.dec)} south`;
    lines.push(
      never.length === 1
        ? `${list(never)} never ${plural(never) ? "rise" : "rises"} from ${city.name}, and only ${plural(never) ? "come" : "comes"} into view ${edge}.`
        : `${list(never)} never rise from ${city.name}. ${nearest.object.name.replace(/^the /, "The ")} only ${nearest.object.plural ? "come" : "comes"} into view ${edge}.`,
    );
  }
  const low = by("skims");
  if (low.length) {
    const side = p.hemisphere === "north" ? "southern" : "northern";
    const best = Math.max(...low.map((o) => o.maxAltitude));
    const reach = best < 2 ? "barely clearing it" : `reaching ${deg(best)} at most`;
    lines.push(`${list(low)} only ${plural(low) ? "skim" : "skims"} the ${side} horizon, ${reach}, so ${plural(low) ? "they need" : "it needs"} a flat, clear view that way.`);
  }
  return lines;
}

function milkyWayLine(p: LatitudeProfile): string {
  const alt = p.galacticCentreAltitude;
  if (alt < 0) return "The bright centre of the Milky Way, in Sagittarius, never rises this far north.";
  if (alt < 15) {
    return `The bright centre of the Milky Way, in Sagittarius, gets no higher than ${deg(alt)} in the south, so haze near the horizon hides most of it.`;
  }
  if (alt > 75) return "The bright centre of the Milky Way, in Sagittarius, passes almost straight overhead on clear June and July evenings.";
  return `The bright centre of the Milky Way, in Sagittarius, climbs to ${deg(alt)} in the ${p.galacticCentreDirection} on clear June and July evenings.`;
}

function planetLine(p: LatitudeProfile): string {
  if (p.sunOverhead) return "The planets follow the sun's path across the sky, and here that path can run straight overhead.";
  const side = p.hemisphere === "north" ? "southern" : "northern";
  return `The planets follow the sun's path, and from here they never climb more than ${deg(p.planetsMaxAltitude)} above the ${side} horizon.`;
}

function darkLines(city: City, p: LatitudeProfile): string[] {
  const [june, december] = p.hemisphere === "north" ? ["June", "December"] : ["December", "June"];
  const lines: string[] = [];
  if (p.midnightSun) {
    lines.push(`Around the ${june} solstice the sun does not set at all.`);
    if (p.polarNight) lines.push(`Around the ${december} solstice it does not rise at all.`);
  }
  if (p.noAstroDark) {
    const r = p.noAstroDark;
    lines.push(`From about ${day(r.from)} to ${day(r.to)} the sun never sinks 18° below the horizon, so the sky never gets fully dark and the faintest stars and the Milky Way fade out.`);
    if (p.noNauticalDark && !p.midnightSun) {
      lines.push(`Between ${day(p.noNauticalDark.from)} and ${day(p.noNauticalDark.to)} even midnight keeps a blue glow in the ${p.hemisphere === "north" ? "north" : "south"}.`);
    }
  } else {
    lines.push(`The sky over ${city.name} gets fully dark on every clear night of the year, even around the ${june} solstice.`);
  }
  if (p.sunOverhead) {
    lines.push("Twice a year the noon sun passes directly overhead.");
  } else if (!p.polarNight) {
    lines.push(`The noon sun reaches ${deg(p.noonSun.summer)} in ${june} and ${deg(Math.max(0, p.noonSun.winter))} in ${december}.`);
  }
  return lines;
}

export function cityProfileParagraphs(city: City): string[] {
  const p = latitudeProfile(city.lat);
  return [
    [poleLine(city, p), ...starLines(city, p)].join(" "),
    [milkyWayLine(p), planetLine(p)].join(" "),
    darkLines(city, p).join(" "),
  ];
}

function hook(p: LatitudeProfile): string {
  const find = (key: string) => p.objects.find((o) => o.object.key === key)!;
  if (p.midnightSun) return p.polarNight ? "the sun stays up all night in midsummer and down all day in midwinter" : "the sun stays up all night around midsummer";
  if (p.noAstroDark) return `the sky never gets fully dark from ${day(p.noAstroDark.from)} to ${day(p.noAstroDark.to)}`;
  const cross = find("southern-cross");
  if (p.hemisphere === "south") {
    return cross.reach === "circumpolar" ? "the Southern Cross never sets" : `Polaris never rises and the Southern Cross climbs to ${deg(cross.maxAltitude)}`;
  }
  if (p.poleAltitude < 15) return "both the Big Dipper and the Southern Cross rise over the year";
  const canopus = find("canopus");
  if (canopus.reach !== "never") return `Canopus, the second-brightest star, rises ${deg(Math.max(1, canopus.maxAltitude))} above the southern horizon`;
  return `Polaris stands ${deg(p.poleAltitude)} up and the Milky Way's core reaches ${deg(Math.max(0, p.galacticCentreAltitude))}`;
}

export function cityDescription(city: City): string {
  const p = latitudeProfile(city.lat);
  return `What to see above ${city.name} tonight, with exact local times. At ${latitudeLabel(city.lat)}, ${hook(p)}.`;
}
