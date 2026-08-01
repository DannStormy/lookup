import { computeSky } from "@/lib/astro/sky";
import type { Place } from "@/lib/astro/types";

// Real-time sky, never cached at the framework level; the engine manages its
// own TLE/aurora caches internally.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  const atParam = searchParams.get("at"); // ISO, for testing/previews

  if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return Response.json(
      { error: "Provide valid lat (-90..90) and lon (-180..180)." },
      { status: 400 },
    );
  }

  const place: Place = { lat, lon, elevation: 0 };
  const at = atParam ? new Date(atParam) : new Date();
  if (isNaN(at.getTime())) {
    return Response.json({ error: "Invalid 'at' timestamp." }, { status: 400 });
  }

  try {
    const report = await computeSky(place, at);
    return Response.json(report, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("computeSky failed:", err);
    return Response.json({ error: "Could not read the sky right now." }, { status: 500 });
  }
}
