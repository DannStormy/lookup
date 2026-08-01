// Starlink trains: the "string of pearls" you see for a few days after a
// launch, before the satellites raise orbit and disperse. We find the freshest
// still-clustered, still-low batch and check for a visible pass tonight.

import { computePasses } from "./iss";
import { compass, heightWord } from "./core";
import type { Place, SkyEvent } from "./types";

const LAST30_URL =
  "https://celestrak.org/NORAD/elements/gp.php?GROUP=last-30-days&FORMAT=tle";

interface Sat {
  name: string;
  l1: string;
  l2: string;
  intdes: string; // launch id: year+number, e.g. "26149"
  meanMotion: number; // rev/day
}

interface Batch {
  intdes: string;
  sats: Sat[];
  medianMeanMotion: number;
}

let cache: { at: number; batches: Batch[] } | null = null;
const TTL = 6 * 60 * 60 * 1000;

function parse(text: string): Sat[] {
  const lines = text.split(/\r?\n/);
  const sats: Sat[] = [];
  for (let i = 0; i + 2 < lines.length; i += 3) {
    const name = lines[i]?.trim();
    const l1 = lines[i + 1];
    const l2 = lines[i + 2];
    if (!l1?.startsWith("1 ") || !l2?.startsWith("2 ")) {
      i -= 2; // resync if the grouping slips
      continue;
    }
    const intdes = l1.substring(9, 14).trim();
    const meanMotion = parseFloat(l2.substring(52, 63));
    if (!isFinite(meanMotion)) continue;
    sats.push({ name: name ?? "", l1, l2, intdes, meanMotion });
  }
  return sats;
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

async function getFreshBatches(): Promise<Batch[]> {
  if (cache && Date.now() - cache.at < TTL) return cache.batches;
  try {
    const res = await fetch(LAST30_URL, {
      headers: { "User-Agent": "lookup-sky/0.1 (astronomy hobby app)" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`celestrak ${res.status}`);
    const sats = parse(await res.text()).filter((s) => /STARLINK/i.test(s.name));

    const byLaunch = new Map<string, Sat[]>();
    for (const s of sats) {
      if (!byLaunch.has(s.intdes)) byLaunch.set(s.intdes, []);
      byLaunch.get(s.intdes)!.push(s);
    }

    const batches: Batch[] = [];
    for (const [intdes, group] of byLaunch) {
      // a real train is a cluster still low enough not to have raised orbit
      if (group.length < 5) continue;
      const mm = median(group.map((s) => s.meanMotion));
      if (mm < 15.5) continue;
      batches.push({ intdes, sats: group, medianMeanMotion: mm });
    }
    // freshest (lowest, so highest mean motion) first
    batches.sort((a, b) => b.medianMeanMotion - a.medianMeanMotion);
    cache = { at: Date.now(), batches };
    return batches;
  } catch {
    return cache?.batches ?? [];
  }
}

export async function starlinkEvents(place: Place, from: Date): Promise<SkyEvent[]> {
  const batches = await getFreshBatches();
  for (const batch of batches) {
    // one member represents the cluster (they pass within a couple of minutes)
    const rep = batch.sats[Math.floor(batch.sats.length / 2)];
    const passes = computePasses(rep.l1, rep.l2, place, from, 48);
    if (!passes.length) continue;

    const p = passes[0];
    const fromDir = compass(p.startAzimuth);
    const toDir = compass(p.endAzimuth);
    const height = heightWord(p.peakElevation);
    const count = batch.sats.length;

    return [
      {
        id: `starlink-${batch.intdes}-${p.peak.getTime()}`,
        kind: "iss",
        title: "A Starlink train",
        subtitle: `A freshly launched string of satellites drifts over in a line, rising in the ${fromDir}.`,
        when: p.peak.toISOString(),
        windowStart: p.start.toISOString(),
        windowEnd: p.end.toISOString(),
        durationMin: Math.max(1, Math.round(p.durationMin)),
        direction: `rising in the ${fromDir}`,
        azimuth: p.peakAzimuth,
        altitude: p.peakElevation,
        // uncommon to catch, but launches are frequent; not "rare"
        rarity: 0.6,
        score: 0,
        tag: `~${count} satellites in a line`,
        detail: `Days after a launch, a batch of Starlink satellites is still bunched together, and they cross the sky as an eerie, evenly-spaced string of moving lights, a "string of pearls." Look ${height} toward the ${fromDir} as they rise, moving toward the ${toDir}. The whole train slides past over a few minutes. It only looks like this for a few days after launch, then they spread out and climb too high to notice. Some people find it beautiful, some find it unsettling. Either way, you're watching something brand new up there.`,
      },
    ];
  }
  return [];
}
