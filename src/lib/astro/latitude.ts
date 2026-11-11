const OBLIQUITY = 23.44;
const REFRACTION = 0.6;

export interface SkyObject {
  key: string;
  name: string;
  dec: number;
  span?: number;
  plural?: boolean;
}

export const LANDMARKS: SkyObject[] = [
  { key: "big-dipper", name: "the Big Dipper", dec: 55.5, span: 6.2 },
  { key: "cassiopeia", name: "Cassiopeia", dec: 60.1, span: 3.6 },
  { key: "capella", name: "Capella", dec: 46.0 },
  { key: "vega", name: "Vega", dec: 38.8 },
  { key: "sirius", name: "Sirius", dec: -16.7 },
  { key: "antares", name: "Antares", dec: -26.4 },
  { key: "fomalhaut", name: "Fomalhaut", dec: -29.6 },
  { key: "canopus", name: "Canopus", dec: -52.7 },
  { key: "achernar", name: "Achernar", dec: -57.2 },
  { key: "alpha-centauri", name: "Alpha Centauri", dec: -60.8 },
  { key: "southern-cross", name: "the Southern Cross", dec: -60.1, span: 3.0 },
  { key: "magellanic-clouds", name: "the Magellanic Clouds", dec: -71.3, span: 1.6, plural: true },
];

const GALACTIC_CENTRE_DEC = -29.0;

export type Reach = "never" | "skims" | "rises" | "circumpolar";

export interface ObjectReach {
  object: SkyObject;
  reach: Reach;
  maxAltitude: number;
}

export interface DayRange {
  from: { month: number; day: number };
  to: { month: number; day: number };
  days: number;
}

export interface LatitudeProfile {
  lat: number;
  hemisphere: "north" | "south";
  poleAltitude: number;
  objects: ObjectReach[];
  galacticCentreAltitude: number;
  galacticCentreDirection: "south" | "north";
  planetsMaxAltitude: number;
  sunOverhead: boolean;
  noonSun: { summer: number; winter: number };
  noAstroDark: DayRange | null;
  noNauticalDark: DayRange | null;
  midnightSun: boolean;
  polarNight: boolean;
}

const upper = (lat: number, dec: number) => 90 - Math.abs(lat - dec);
const lower = (lat: number, dec: number) => Math.abs(lat + dec) - 90;

// A constellation counts as circumpolar only if all of it stays up, and as never rising only if none of it clears the horizon.
function reachOf(lat: number, { dec, span = 0 }: SkyObject): { reach: Reach; maxAltitude: number } {
  const maxAltitude = upper(lat, dec);
  if (Math.min(lower(lat, dec - span), lower(lat, dec + span)) > 0) return { reach: "circumpolar", maxAltitude };
  if (Math.max(upper(lat, dec - span), upper(lat, dec + span)) < 0) return { reach: "never", maxAltitude };
  if (maxAltitude < 10) return { reach: "skims", maxAltitude };
  return { reach: "rises", maxAltitude };
}

function sunDeclination(dayOfYear: number): number {
  return -OBLIQUITY * Math.cos(((2 * Math.PI) / 365) * (dayOfYear + 10));
}

function monthDay(dayOfYear: number) {
  const d = new Date(Date.UTC(2026, 0, 1 + dayOfYear));
  return { month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

// The sun's lowest point of the night stays above `depression`; for the south the run wraps New Year.
function brightNights(lat: number, depression: number): DayRange | null {
  const start = lat >= 0 ? 0 : 182;
  const bright: number[] = [];
  for (let i = 0; i < 365; i++) {
    const d = (start + i) % 365;
    if (lower(lat, sunDeclination(d)) + REFRACTION > depression) bright.push(i);
  }
  if (!bright.length) return null;
  return {
    from: monthDay((start + bright[0]) % 365),
    to: monthDay((start + bright[bright.length - 1]) % 365),
    days: bright.length,
  };
}

export function latitudeProfile(lat: number): LatitudeProfile {
  const north = lat >= 0;
  const summerDec = north ? OBLIQUITY : -OBLIQUITY;
  return {
    lat,
    hemisphere: north ? "north" : "south",
    poleAltitude: Math.abs(lat),
    objects: LANDMARKS.map((object) => ({ object, ...reachOf(lat, object) })),
    galacticCentreAltitude: upper(lat, GALACTIC_CENTRE_DEC),
    galacticCentreDirection: lat > GALACTIC_CENTRE_DEC ? "south" : "north",
    planetsMaxAltitude: Math.min(90, 90 - Math.abs(lat) + OBLIQUITY),
    sunOverhead: Math.abs(lat) <= OBLIQUITY,
    noonSun: { summer: upper(lat, summerDec), winter: upper(lat, -summerDec) },
    noAstroDark: brightNights(lat, -18),
    noNauticalDark: brightNights(lat, -12),
    midnightSun: lower(lat, summerDec) + REFRACTION > 0,
    polarNight: upper(lat, -summerDec) + REFRACTION < 0,
  };
}
