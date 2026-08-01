import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS home-screen icon (needed for Add to Home Screen, which iOS requires
// before it will allow web push).
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundImage:
            "radial-gradient(120px 120px at 50% 34%, #2a2864 0%, #12163a 52%, #05060d 100%)",
        }}
      >
        <svg width="120" height="120" viewBox="0 0 10 10">
          <path d="M5 0.6 L6 4 L9.4 5 L6 6 L5 9.4 L4 6 L0.6 5 L4 4 Z" fill="#f4d9a0" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
