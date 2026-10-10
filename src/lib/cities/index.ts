import { CITY_ROWS } from "./data";

export interface City {
  slug: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
  tz: string;
}

export const CITIES: City[] = CITY_ROWS.map(([slug, name, country, lat, lon, tz]) => ({
  slug,
  name,
  country,
  lat,
  lon,
  tz,
}));

const BY_SLUG = new Map(CITIES.map((c) => [c.slug, c]));

export function getCity(slug: string): City | undefined {
  return BY_SLUG.get(slug);
}

export function citiesByCountry(): { country: string; cities: City[] }[] {
  const groups = new Map<string, City[]>();
  for (const c of CITIES) {
    const list = groups.get(c.country);
    if (list) list.push(c);
    else groups.set(c.country, [c]);
  }
  return [...groups]
    .map(([country, cities]) => ({ country, cities }))
    .sort((a, b) => b.cities.length - a.cities.length || a.country.localeCompare(b.country));
}

function distanceKm(a: City, b: City): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

export function nearbyCities(city: City, count = 6): City[] {
  return CITIES.filter((c) => c.slug !== city.slug)
    .sort((a, b) => distanceKm(city, a) - distanceKm(city, b))
    .slice(0, count);
}

export function appHref(city: City): string {
  const q = new URLSearchParams({
    lat: String(city.lat),
    lon: String(city.lon),
    name: city.name,
  });
  return `/?${q.toString()}`;
}
