import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { lookPhrase } from "@/lib/astro/core";
import { getShower, showerForecast } from "@/lib/astro/shower-forecast";
import { getCity } from "@/lib/cities";
import { bestTime, moonLine, peakNight } from "@/lib/shower-copy";
import { SITE_URL } from "@/lib/site";

export const runtime = "nodejs";

const FONTS = {
  inter400: readFileSync(new URL("../inter-400.woff", import.meta.url)),
  fraunces400: readFileSync(new URL("../fraunces-400.woff", import.meta.url)),
  fraunces600: readFileSync(new URL("../fraunces-600.woff", import.meta.url)),
};

const STARS = Array.from({ length: 70 }, (_, i) => ({
  left: (i * 39.7) % 100,
  top: (i * 71.3) % 100,
  r: i % 5 === 0 ? 2.8 : 1.5,
}));

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", marginTop: 64 }}>
      <div style={{ display: "flex", fontSize: 30, letterSpacing: 4, color: "#8a91b0", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ display: "flex", marginTop: 12, fontFamily: "Fraunces", fontSize: 60, lineHeight: 1.2, color: "#eef1fb" }}>
        {value}
      </div>
    </div>
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const shower = getShower(searchParams.get("shower") ?? "");
  const city = getCity(searchParams.get("city") ?? "");
  if (!shower || !city) return new Response("unknown shower or city", { status: 404 });

  const f = showerForecast(shower, { lat: city.lat, lon: city.lon, elevation: 0 });
  if (!f.visible || !f.best || !f.dusk) {
    return new Response("not visible from this city", { status: 422 });
  }

  const host = new URL(SITE_URL).host;
  const look = lookPhrase(f.best.altitude, f.best.azimuth);

  // Top and bottom padding clear the TikTok and Reels interface overlays.
  return new ImageResponse(
    (
      <div
        style={{
          width: "1080px",
          height: "1920px",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          padding: "210px 130px 340px 80px",
          backgroundColor: "#080b1d",
          backgroundImage:
            "radial-gradient(1300px 1100px at 50% -5%, #2a2864 0%, #12163a 40%, #05060d 78%)",
          fontFamily: "Inter",
          color: "#eef1fb",
        }}
      >
        {STARS.map((s, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: s.r * 2,
              height: s.r * 2,
              borderRadius: 99,
              background: "rgba(238,241,251,0.6)",
            }}
          />
        ))}

        <div style={{ display: "flex", fontSize: 30, letterSpacing: 6, color: "#b6a2f0", textTransform: "uppercase" }}>
          {peakNight(new Date(f.dusk), city.tz)}
        </div>
        <div style={{ display: "flex", marginTop: 24, fontFamily: "Fraunces", fontWeight: 600, fontSize: 150, lineHeight: 1 }}>
          {shower.name}
        </div>
        <div style={{ display: "flex", marginTop: 20, fontFamily: "Fraunces", fontSize: 62, color: "#a6adc8" }}>
          from {city.name}
        </div>

        <Row label="Best time" value={bestTime(f, city.tz, "label")} />
        <Row label="Look" value={look.charAt(0).toUpperCase() + look.slice(1)} />
        <Row label="Dark sky, up to" value={`${f.best.rate} meteors an hour`} />
        <Row label="Moon" value={moonLine(f, city.tz)} />

        <div style={{ display: "flex", flex: 1 }} />

        <div style={{ display: "flex", fontSize: 30, color: "#8a91b0" }}>Far fewer from inside a city.</div>
        <div style={{ display: "flex", marginTop: 16, fontSize: 32, color: "#f4d9a0" }}>{host}</div>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
      fonts: [
        { name: "Inter", data: FONTS.inter400, weight: 400, style: "normal" },
        { name: "Fraunces", data: FONTS.fraunces400, weight: 400, style: "normal" },
        { name: "Fraunces", data: FONTS.fraunces600, weight: 600, style: "normal" },
      ],
      headers: { "Cache-Control": "public, max-age=1800, s-maxage=1800" },
    },
  );
}
