import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Fraunces } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Literary serif for the lines meant to be read slowly.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "opsz"],
});

// Prefer an explicit domain; otherwise use Vercel's own URLs so share cards
// still resolve on a fresh deploy before a custom domain is set.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Look Up: the sky above you tonight",
  description:
    "Rare, beautiful things happen in the sky right above you. Look Up tells you what, where, and the exact minute to look.",
  openGraph: {
    title: "Look Up: the sky above you tonight",
    description:
      "The space station overhead, a planet you keep mistaking for a star, meteors if you know which night. The exact sky above your exact spot, and when to look up.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Look Up: the sky above you tonight",
    description:
      "The exact sky above your exact spot, and the precise minute to look up.",
  },
};

export const viewport: Viewport = {
  themeColor: "#05060d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
