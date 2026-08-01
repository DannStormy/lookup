// What we keep for each device that wants to be tapped on the shoulder.

export interface PushKeys {
  p256dh: string;
  auth: string;
}

export interface WebPushSubscription {
  endpoint: string;
  keys: PushKeys;
}

// One switch per kind of thing we might tap someone about.
export type PrefKey = "iss" | "starlink" | "aurora" | "meteor" | "comet";

export interface Prefs {
  /** the space station passing overhead (and its rare sun/moon transits) */
  iss: boolean;
  /** a freshly launched Starlink train */
  starlink: boolean;
  /** aurora likely tonight (rare, high emotion) */
  aurora: boolean;
  /** meteor shower peaks */
  meteor: boolean;
  /** a bright comet is visible */
  comet: boolean;
  /** how many minutes before the moment to tap them */
  leadMin: number;
}

export const DEFAULT_PREFS: Prefs = {
  iss: true,
  starlink: true,
  aurora: true,
  meteor: true,
  comet: true,
  leadMin: 12,
};

export const PREF_LABELS: { key: PrefKey; label: string; note: string }[] = [
  { key: "iss", label: "The space station", note: "Bright passes, and the rare moment it crosses the sun or moon" },
  { key: "starlink", label: "Starlink trains", note: "A freshly launched string of satellites" },
  { key: "aurora", label: "Aurora", note: "When a storm might bring it to your latitude" },
  { key: "meteor", label: "Meteor showers", note: "The night a shower peaks over you" },
  { key: "comet", label: "Comets", note: "When one is bright enough to find" },
];

export interface PushRecord {
  /** stable id derived from the endpoint */
  id: string;
  subscription: WebPushSubscription;
  lat: number;
  lon: number;
  label?: string;
  /** IANA timezone if the client sent one; for future quiet-hours */
  tz?: string;
  prefs: Prefs;
  createdAt: number;
  /** eventId -> unix ms we last pushed it, so we never nag twice */
  notified: Record<string, number>;
}
