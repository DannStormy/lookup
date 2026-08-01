// The vocabulary of the sky. One event = one reason to look up.

export type SkyEventKind =
  | "iss"
  | "planet"
  | "moon"
  | "meteor"
  | "aurora"
  | "conjunction";

export interface SkyEvent {
  id: string;
  kind: SkyEventKind;
  /** Short name of the thing. "The space station", "Jupiter", "Perseid meteors". */
  title: string;
  /** One-line poem. The reason to care. */
  subtitle: string;
  /** The single moment to look, ISO. Null means "any time it's dark tonight". */
  when: string | null;
  /** Visible window if it's a pass or timed event. */
  windowStart?: string;
  windowEnd?: string;
  durationMin?: number;
  /** Where to point your face. "northwest", "high in the south". */
  direction?: string;
  azimuth?: number;
  /** Peak altitude in degrees above the horizon. */
  altitude?: number;
  /** Apparent brightness. Lower = brighter. */
  magnitude?: number;
  /** 0..1. How rare this is. Drives how special it feels. */
  rarity: number;
  /** Internal ranking score. Higher = show first. */
  score: number;
  /** A short factual tag. "Overhead pass", "Waxing gibbous, 87%". */
  tag: string;
  /** Longer description, still calm and human. */
  detail: string;
}

export interface Place {
  lat: number;
  lon: number;
  /** meters above sea level; 0 is a fine default */
  elevation?: number;
  /** human label, if we resolved one */
  label?: string;
}

export interface SkyReport {
  place: Place;
  /** when this was computed, ISO */
  generatedAt: string;
  /** tonight's darkness window, if the sun sets where you are */
  night: { dusk: string | null; dawn: string | null };
  /** is it dark enough to see faint things right now, at this place */
  darkNow: boolean;
  moonIllumination: number; // 0..1, affects how dark the sky really is
  /** ranked, best first */
  events: SkyEvent[];
  /** a forward hook so the night never ends on "nothing" */
  comingUp: { title: string; when: string; note: string } | null;
}
