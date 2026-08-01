import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { computeSky } from "@/lib/astro/sky";
import type { SkyEventKind } from "@/lib/astro/types";

// The faceless distribution artifact: a beautiful, self-contained card of the
// sky above one place tonight. Generated on demand, cache-friendly.
export const runtime = "nodejs";

// Co-located fonts. `new URL(asset, import.meta.url)` is traced as a shipped
// asset (unlike require.resolve), and readFileSync accepts the file URL.
const FONTS = {
  inter400: readFileSync(new URL("./inter-400.woff", import.meta.url)),
  fraunces400: readFileSync(new URL("./fraunces-400.woff", import.meta.url)),
  fraunces600: readFileSync(new URL("./fraunces-600.woff", import.meta.url)),
};

const HUE: Record<SkyEventKind, string> = {
  iss: "#d8def0",
  aurora: "#7ee0c0",
  meteor: "#b6a2f0",
  planet: "#f2c98a",
  moon: "#bcd0f0",
  conjunction: "#f0a6c2",
};

// a few fixed "stars" so every card feels like a night sky (deterministic)
const STARS = Array.from({ length: 46 }, (_, i) => {
  const a = (i * 39.7) % 100;
  const b = (i * 71.3) % 100;
  return { left: a, top: (b * 0.72) % 100, r: (i % 5 === 0 ? 2.4 : 1.3) };
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  const name = (searchParams.get("name") || "your sky").slice(0, 40);

  if (!isFinite(lat) || !isFinite(lon)) {
    return new Response("bad coords", { status: 400 });
  }

  const report = await computeSky({ lat, lon, elevation: 0 });
  const hero = report.events[0];
  const also = report.events
    .slice(1, 4)
    .map((e) => e.title.replace(/^The /, ""))
    .join(", ");

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          padding: "72px 80px",
          backgroundColor: "#080b1d",
          backgroundImage:
            "radial-gradient(1000px 520px at 50% -10%, #2a2864 0%, #12163a 34%, #05060d 72%)",
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
              background: "rgba(238,241,251,0.7)",
            }}
          />
        ))}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 22,
            letterSpacing: 6,
            color: "#646b8a",
            textTransform: "uppercase",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 10 10" style={{ marginRight: 12 }}>
            <path d="M5 0 L6 4 L10 5 L6 6 L5 10 L4 6 L0 5 L4 4 Z" fill="#f4d9a0" />
          </svg>
          Look Up
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontSize: 26,
            letterSpacing: 4,
            color: HUE[hero?.kind ?? "moon"],
            textTransform: "uppercase",
          }}
        >
          Tonight from {name}
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 18,
            fontFamily: "Fraunces",
            fontWeight: 600,
            fontSize: 92,
            lineHeight: 1.02,
            color: "#eef1fb",
          }}
        >
          {hero?.title ?? "A quiet sky"}
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 26,
            fontFamily: "Fraunces",
            fontWeight: 400,
            fontSize: 38,
            lineHeight: 1.3,
            color: "#a6adc8",
            maxWidth: 940,
          }}
        >
          {hero?.subtitle ?? "Come back when the dark returns."}
        </div>

        <div style={{ display: "flex", flex: 1 }} />

        {also && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              fontSize: 28,
              color: "#646b8a",
            }}
          >
            <span style={{ display: "flex", color: "#a6adc8" }}>Also up tonight:&nbsp;</span>
            {also}
          </div>
        )}

        <div
          style={{
            display: "flex",
            marginTop: 22,
            paddingTop: 22,
            borderTop: "1px solid rgba(255,255,255,0.1)",
            fontSize: 24,
            color: "#646b8a",
          }}
        >
          The exact sky above your exact spot, and when to look up.
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Inter", data: FONTS.inter400, weight: 400, style: "normal" },
        { name: "Fraunces", data: FONTS.fraunces400, weight: 400, style: "normal" },
        { name: "Fraunces", data: FONTS.fraunces600, weight: 600, style: "normal" },
      ],
      headers: {
        "Cache-Control": "public, max-age=1800, s-maxage=1800",
      },
    },
  );
}
