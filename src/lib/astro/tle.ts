// Fetch + cache the ISS orbital elements. CelesTrak rate-limits hard, so we
// fetch at most every few hours and keep a baked-in fallback so the app never
// goes dark. TLEs age gracefully; a day or two old still gives good passes.

const CELESTRAK_ISS =
  "https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE";

// Baked-in fallback (updated at build time). Stale but keeps the engine alive.
const FALLBACK: TleSet = {
  line1: "1 25544U 98067A   26208.51782528  .00016717  00000+0  30510-3 0  9993",
  line2: "2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.72125391 20000",
  fetchedAt: 0,
  source: "fallback",
};

export interface TleSet {
  line1: string;
  line2: string;
  fetchedAt: number;
  source: "celestrak" | "cache" | "fallback";
}

let cache: TleSet | null = null;
const TTL_MS = 3 * 60 * 60 * 1000; // 3h, comfortably above CelesTrak's cadence

export async function getIssTle(): Promise<TleSet> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < TTL_MS) {
    return { ...cache, source: "cache" };
  }
  try {
    const res = await fetch(CELESTRAK_ISS, {
      headers: { "User-Agent": "lookup-sky/0.1 (astronomy hobby app)" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`celestrak ${res.status}`);
    const text = (await res.text()).trim();
    const lines = text.split(/\r?\n/).map((l) => l.trim());
    const l1 = lines.find((l) => l.startsWith("1 "));
    const l2 = lines.find((l) => l.startsWith("2 "));
    if (!l1 || !l2) throw new Error("no TLE lines in response");
    cache = { line1: l1, line2: l2, fetchedAt: now, source: "celestrak" };
    return cache;
  } catch {
    // Rate-limited or offline: use last good cache, else the baked fallback.
    if (cache) return { ...cache, source: "cache" };
    return { ...FALLBACK, fetchedAt: now };
  }
}
