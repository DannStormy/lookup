import type { SkyEventKind } from "./astro/types";

export function hueVar(kind: SkyEventKind): string {
  return `var(--hue-${kind})`;
}

/** "9:47 PM" in the viewer's local time. */
export function localTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "9:47:32 PM" — for transits, where the exact second is the whole point. */
export function localTimeSeconds(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** A soft, human countdown. Returns null once the moment has passed. */
export function countdown(targetIso: string, now: number): string {
  const diff = new Date(targetIso).getTime() - now;
  if (diff <= 0) return "now";
  const s = Math.floor(diff / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `in ${d}d ${h}h`;
  if (h > 0) return `in ${h}h ${m}m`;
  if (m > 0) return `in ${m}m ${sec.toString().padStart(2, "0")}s`;
  return `in ${sec}s`;
}

/** True while now is inside [start, end]. */
export function isHappeningNow(
  startIso: string | undefined,
  endIso: string | undefined,
  now: number,
): boolean {
  if (!startIso || !endIso) return false;
  const s = new Date(startIso).getTime();
  const e = new Date(endIso).getTime();
  return now >= s && now <= e;
}

const KIND_LABEL: Record<SkyEventKind, string> = {
  iss: "Space station",
  aurora: "Aurora",
  meteor: "Meteor shower",
  planet: "Planet",
  moon: "Moon",
  conjunction: "Conjunction",
};

export function kindLabel(kind: SkyEventKind): string {
  return KIND_LABEL[kind];
}

/** A whispered line when the sky is doing something genuinely uncommon. */
export function rarityWhisper(rarity: number): string | null {
  if (rarity >= 0.88) return "This is genuinely rare. Look while you can.";
  if (rarity >= 0.75) return "You won't get many nights like this.";
  if (rarity >= 0.62) return "A rare one.";
  return null;
}

function partsIn(iso: string, tz: string): Record<string, string> {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(new Date(iso));
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

// Built from parts: ICU versions disagree on the space before AM/PM, which breaks hydration.
export function timeIn(iso: string, tz: string): string {
  const p = partsIn(iso, tz);
  return `${p.hour}:${p.minute} ${p.dayPeriod}`;
}

/** "Today, 9:47 PM" / "Tomorrow, 5:12 AM" / "Monday, 5:12 AM", in a named zone. */
export function dayTimeIn(iso: string, tz: string, nowIso: string): string {
  const p = partsIn(iso, tz);
  const n = partsIn(nowIso, tz);
  const dayNumber = (x: Record<string, string>) =>
    Date.UTC(Number(x.year), Number(x.month) - 1, Number(x.day)) / 86400000;
  const diff = dayNumber(p) - dayNumber(n);
  const day = diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : p.weekday;
  return `${day}, ${p.hour}:${p.minute} ${p.dayPeriod}`;
}

/** "Sunday, December 13" in a named zone. */
export function dateIn(iso: string, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).formatToParts(new Date(iso));
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return `${p.weekday}, ${p.month} ${p.day}`;
}
