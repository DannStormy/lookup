import * as sat from "satellite.js";
import { Body, GeoVector } from "astronomy-engine";
import { observerOf, sunAltitude, compass, heightWord } from "./core";
import type { Place, SkyEvent } from "./types";

const EARTH_RADIUS_KM = 6378.137;
const DEG = 180 / Math.PI;

export interface Pass {
  start: Date;
  peak: Date;
  end: Date;
  peakElevation: number; // degrees
  peakAzimuth: number; // degrees
  startAzimuth: number;
  endAzimuth: number;
  durationMin: number;
  visible: boolean; // sunlit sat + dark observer at some point in the pass
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Is the satellite in sunlight (not inside Earth's cylindrical shadow)? */
function sunlit(satEci: Vec3, date: Date): boolean {
  // Sun direction in a compatible equatorial frame (astronomy-engine EQJ ~ TEME
  // for a boolean shadow test; the sub-degree frame drift is irrelevant here).
  const s = GeoVector(Body.Sun, date, false);
  const sMag = Math.hypot(s.x, s.y, s.z);
  const ux = s.x / sMag,
    uy = s.y / sMag,
    uz = s.z / sMag;
  const along = satEci.x * ux + satEci.y * uy + satEci.z * uz;
  const satMag2 = satEci.x ** 2 + satEci.y ** 2 + satEci.z ** 2;
  const perp = Math.sqrt(Math.max(0, satMag2 - along * along));
  const inShadow = along < 0 && perp < EARTH_RADIUS_KM;
  return !inShadow;
}

/**
 * Scan the next `hours` for passes of a satellite over an observer.
 * A pass = a contiguous run above 10 deg elevation. It is "visible" if,
 * at some point in that run, the satellite is sunlit and the sky is dark.
 */
export function computePasses(
  tleLine1: string,
  tleLine2: string,
  place: Place,
  from: Date,
  hours = 48,
  stepSec = 30,
): Pass[] {
  const satrec = sat.twoline2satrec(tleLine1, tleLine2);
  const obs = observerOf(place);
  const obsGd = {
    longitude: sat.degreesToRadians(place.lon),
    latitude: sat.degreesToRadians(place.lat),
    height: (place.elevation ?? 0) / 1000, // km
  };

  const passes: Pass[] = [];
  const steps = Math.floor((hours * 3600) / stepSec);

  let inPass = false;
  let cur: {
    start: Date;
    startAz: number;
    peakEl: number;
    peakAz: number;
    peakT: Date;
    visible: boolean;
    lastT: Date;
    lastAz: number;
  } | null = null;

  for (let i = 0; i <= steps; i++) {
    const t = new Date(from.getTime() + i * stepSec * 1000);
    let pv: ReturnType<typeof sat.propagate>;
    try {
      pv = sat.propagate(satrec, t);
    } catch {
      continue;
    }
    if (!pv || !pv.position || typeof pv.position === "boolean") continue;
    const eci = pv.position as Vec3;
    const gmst = sat.gstime(t);
    const ecf = sat.eciToEcf(eci, gmst);
    const look = sat.ecfToLookAngles(obsGd, ecf);
    const elDeg = look.elevation * DEG;
    const azDeg = ((look.azimuth * DEG) % 360 + 360) % 360;

    if (elDeg >= 10) {
      const litAndDark = sunlit(eci, t) && sunAltitude(t, obs) < -6;
      if (!inPass) {
        inPass = true;
        cur = {
          start: t,
          startAz: azDeg,
          peakEl: elDeg,
          peakAz: azDeg,
          peakT: t,
          visible: litAndDark,
          lastT: t,
          lastAz: azDeg,
        };
      } else if (cur) {
        if (elDeg > cur.peakEl) {
          cur.peakEl = elDeg;
          cur.peakAz = azDeg;
          cur.peakT = t;
        }
        cur.visible = cur.visible || litAndDark;
        cur.lastT = t;
        cur.lastAz = azDeg;
      }
    } else if (inPass && cur) {
      passes.push(finalize(cur));
      inPass = false;
      cur = null;
    }
  }
  if (inPass && cur) passes.push(finalize(cur));

  return passes.filter((p) => p.visible);
}

function finalize(c: {
  start: Date;
  startAz: number;
  peakEl: number;
  peakAz: number;
  peakT: Date;
  visible: boolean;
  lastT: Date;
  lastAz: number;
}): Pass {
  return {
    start: c.start,
    peak: c.peakT,
    end: c.lastT,
    peakElevation: c.peakEl,
    peakAzimuth: c.peakAz,
    startAzimuth: c.startAz,
    endAzimuth: c.lastAz,
    durationMin: (c.lastT.getTime() - c.start.getTime()) / 60000,
    visible: c.visible,
  };
}

/** Estimate ISS brightness: higher, more overhead passes are brighter. */
function issMagnitude(peakEl: number): number {
  // Roughly -1.5 near the horizon down to about -3.9 near the zenith.
  return -1.5 - (peakEl / 90) * 2.4;
}

export function issEvents(passes: Pass[]): SkyEvent[] {
  return passes.slice(0, 4).map((p, idx) => {
    const mag = issMagnitude(p.peakElevation);
    const fromDir = compass(p.startAzimuth);
    const toDir = compass(p.endAzimuth);
    const height = heightWord(p.peakElevation);
    const mins = Math.max(1, Math.round(p.durationMin));
    const overhead = p.peakElevation >= 60;
    // A bright overhead pass is the closest thing to a guaranteed "wow".
    const rarity = overhead ? 0.7 : p.peakElevation >= 35 ? 0.55 : 0.42;

    return {
      id: `iss-${p.peak.getTime()}`,
      kind: "iss",
      title: idx === 0 ? "The space station" : "The space station returns",
      subtitle: overhead
        ? `A bright overhead pass. It rises in the ${fromDir} and sails almost straight above you.`
        : `It climbs from the ${fromDir}, crosses ${height}, and sets toward the ${toDir}.`,
      when: p.peak.toISOString(),
      windowStart: p.start.toISOString(),
      windowEnd: p.end.toISOString(),
      durationMin: mins,
      direction: `rising in the ${fromDir}`,
      azimuth: p.peakAzimuth,
      altitude: p.peakElevation,
      magnitude: mag,
      rarity,
      score: 0,
      tag: `Peaks ${Math.round(p.peakElevation)}° up · ${mins} min`,
      detail: `Seven astronauts, four hundred kilometres up, moving at eight kilometres a second. It looks like a bright star that refuses to twinkle, sliding silently across the sky. Start watching low in the ${fromDir} a minute early; it will climb to ${height} in the ${compass(p.peakAzimuth)}, then fade out as it enters Earth's shadow near the ${toDir}. No telescope, no app pointed at the sky, just look up.`,
    };
  });
}
