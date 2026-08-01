"use client";

import { hueVar } from "@/lib/format";
import type { SkyEventKind } from "@/lib/astro/types";

// A quiet map of where to point your face: a compass strip for the horizon,
// height for how far up. The glowing dot is the thing itself.
const W = 320;
const H = 124;
const PAD = 15; // keep edge labels (N) from clipping
const HORIZON = 104; // y of the horizon line
const ZENITH = 14; // y of straight-up

const TICKS = [
  { az: 0, label: "N" },
  { az: 45, label: "NE" },
  { az: 90, label: "E" },
  { az: 135, label: "SE" },
  { az: 180, label: "S" },
  { az: 225, label: "SW" },
  { az: 270, label: "W" },
  { az: 315, label: "NW" },
  { az: 360, label: "N" },
];

function xForAz(az: number): number {
  const frac = (((az % 360) + 360) % 360) / 360;
  return PAD + frac * (W - 2 * PAD);
}
function yForAlt(alt: number): number {
  const clamped = Math.max(0, Math.min(90, alt));
  return HORIZON - (clamped / 90) * (HORIZON - ZENITH);
}

export default function SkyPointer({
  azimuth,
  altitude,
  kind,
}: {
  azimuth: number;
  altitude: number;
  kind: SkyEventKind;
}) {
  const x = xForAz(azimuth);
  const y = yForAlt(altitude);
  const hue = hueVar(kind);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mt-8 h-auto w-full max-w-[340px]"
      role="img"
      aria-label={`Look toward compass bearing ${Math.round(azimuth)} degrees, ${Math.round(altitude)} degrees above the horizon`}
    >
      {/* horizon */}
      <line
        x1="0"
        y1={HORIZON}
        x2={W}
        y2={HORIZON}
        stroke="var(--line)"
        strokeWidth="1"
      />
      {/* cardinal ticks + labels */}
      {TICKS.map((t, i) => {
        const tx = xForAz(t.az);
        const major = t.label.length === 1;
        return (
          <g key={i}>
            <line
              x1={tx}
              y1={HORIZON - (major ? 5 : 3)}
              x2={tx}
              y2={HORIZON}
              stroke="var(--line)"
              strokeWidth="1"
            />
            <text
              x={tx}
              y={HORIZON + 15}
              textAnchor="middle"
              fontSize="9"
              letterSpacing="1"
              fill={major ? "var(--ink-dim)" : "rgba(100,107,138,0.55)"}
            >
              {t.label}
            </text>
          </g>
        );
      })}

      {/* plumb line from the object down to the horizon */}
      <line
        x1={x}
        y1={y}
        x2={x}
        y2={HORIZON}
        stroke={hue}
        strokeOpacity="0.28"
        strokeWidth="1"
        strokeDasharray="2 3"
      />

      {/* the object: a soft halo and a bright core */}
      <circle cx={x} cy={y} r="9" fill={hue} opacity="0.12" />
      <circle cx={x} cy={y} r="4.5" fill={hue} opacity="0.28" />
      <circle cx={x} cy={y} r="2.4" fill={hue}>
        <animate
          attributeName="opacity"
          values="0.75;1;0.75"
          dur="3.4s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
}
