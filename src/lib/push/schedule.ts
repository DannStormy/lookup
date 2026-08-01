// The decision the scheduler makes: given a subscriber and their sky right now,
// what (if anything) should we tap them about, and with what words.

import type { SkyEvent, SkyReport } from "../astro/types";
import type { PrefKey, PushRecord } from "./types";
import type { PushPayload } from "./send";

export interface DueNotification {
  key: string; // dedupe key stored in rec.notified
  payload: PushPayload;
}

/** Which preference switch governs this event. */
function categoryOf(e: SkyEvent): PrefKey | null {
  if (e.id.startsWith("starlink-")) return "starlink";
  if (e.id.startsWith("comet-")) return "comet";
  if (e.kind === "iss") return "iss"; // passes and sun/moon transits
  if (e.kind === "aurora") return "aurora";
  if (e.kind === "meteor") return "meteor";
  return null; // planets, moon, conjunctions aren't push-worthy
}

// missing/undefined pref means "on" (so new categories light up for old subs)
function wants(rec: PushRecord, cat: PrefKey): boolean {
  return rec.prefs[cat] !== false;
}

function timedPayload(e: SkyEvent, mins: number, url: string): PushPayload {
  const when = mins <= 1 ? "now" : `in about ${Math.round(mins)} minutes`;
  const isTransit = e.id.startsWith("transit-");
  const tail = isTransit
    ? " Open Look Up for the exact second."
    : " Go outside and look.";
  return {
    title: mins <= 1 ? "Look up now" : `Look up ${when}`,
    body: e.subtitle + tail,
    url,
    tag: `lookup-${categoryOf(e) ?? "sky"}`,
    eventId: e.id,
  };
}

function nightPayload(e: SkyEvent, cat: PrefKey, url: string): PushPayload {
  const aurora = cat === "aurora";
  return {
    title: aurora ? "Aurora may be visible tonight" : e.title,
    body: aurora
      ? `${e.subtitle} Get away from lights and give your eyes time to adjust.`
      : e.subtitle,
    url,
    tag: `lookup-${cat}`,
    eventId: e.id,
  };
}

const TIMED: PrefKey[] = ["iss", "starlink"]; // have a precise start time
const ALL_NIGHT: PrefKey[] = ["aurora", "meteor", "comet"];

/**
 * Which events for this subscriber are due to send at `now`.
 * - timed (station pass, transit, Starlink): fire within their lead time.
 * - aurora / meteor peak / comet: fire once per night, while it's dark.
 */
export function dueNotifications(
  rec: PushRecord,
  report: SkyReport,
  now: number,
  siteUrl: string,
): DueNotification[] {
  const out: DueNotification[] = [];
  const localDate = new Date(now).toISOString().slice(0, 10);
  const url = siteUrl.replace(/\/$/, "") + "/";

  for (const e of report.events) {
    const cat = categoryOf(e);
    if (!cat || !wants(rec, cat)) continue;

    if (TIMED.includes(cat) && e.windowStart) {
      const mins = (Date.parse(e.windowStart) - now) / 60000;
      if (mins <= rec.prefs.leadMin && mins >= -2 && !rec.notified[e.id]) {
        out.push({ key: e.id, payload: timedPayload(e, mins, url) });
      }
    } else if (ALL_NIGHT.includes(cat)) {
      if (report.darkNow) {
        const key = `${e.id}:${localDate}`; // once per night
        if (!rec.notified[key]) {
          out.push({ key, payload: nightPayload(e, cat, url) });
        }
      }
    }
  }
  return out;
}
