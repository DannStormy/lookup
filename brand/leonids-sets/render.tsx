import { ImageResponse } from "next/og";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { lookPhrase } from "@/lib/astro/core";
import { getShower, showerForecast } from "@/lib/astro/shower-forecast";
import { getCity } from "@/lib/cities";
import { timeIn } from "@/lib/format";

const ROOT = "/Users/dann/Documents/my-proj/lookup";
const OUT = `${ROOT}/brand/leonids-sets/slides`;
const font = (f: string) => readFileSync(`${ROOT}/src/app/api/card/${f}.woff`);

type Slide = {
  file: string;
  photo: string;
  credit: string;
  kicker: string;
  title: string;
  body: string[];
  accent?: string;
};

const INGALLS = "Photo: NASA/Bill Ingalls";
const PHOTOS = [
  { photo: "NHQ202108110005", credit: `${INGALLS}, Perseid shower, 2021` },
  { photo: "NHQ202508030001", credit: `${INGALLS}, Perseid meteor, 2025` },
  { photo: "NHQ202108110003", credit: `${INGALLS}, Perseid shower, 2021` },
  { photo: "NHQ202108110001", credit: INGALLS },
  { photo: "NHQ202108100009", credit: INGALLS },
];

const leonids = getShower("leonids")!;

function citySlide(key: string): Omit<Slide, "file" | "photo" | "credit"> {
  const city = getCity(key)!;
  const f = showerForecast(leonids, { lat: city.lat, lon: city.lon, elevation: 0 });
  if (!f.best || !f.dawn) throw new Error(`${key}: no forecast`);
  const look = lookPhrase(f.best.altitude, f.best.azimuth);
  return {
    kicker: city.name,
    title: `Before ${timeIn(f.dawn, city.tz).replace(" ", " ")}`,
    body: [
      `Go out in the last dark hour and look ${look}.`,
      `Up to about ${f.best.rate} meteors an hour under a dark sky.`,
    ],
  };
}

const howTo = {
  kicker: "How to watch",
  title: "No telescope needed",
  body: [
    "Get away from street lights.",
    "Give your eyes 20 minutes to adjust, and keep your phone away.",
    "Lie back and take in the whole sky.",
  ],
};

const follow = {
  kicker: "Next up",
  title: "The Geminids, Dec 13",
  body: ["The best meteor shower of the year. Follow so you don't miss it.", "Any city, any night:"],
  accent: "lookup.evenfallhq.com",
};

function set(prefix: string, region: string, cities: string[]): Slide[] {
  const names = cities.map((c) => getCity(c)!.name);
  const list = names.length > 2 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names.join(" and ");
  const content = [
    {
      kicker: "Monday night, Nov 16, into Tuesday",
      title: `The Leonids from ${region}`,
      body: [`When and where to look from ${list}.`, "Save this for Monday night."],
    },
    ...cities.map(citySlide),
    howTo,
    follow,
  ];
  return content.map((c, i) => ({ ...c, ...PHOTOS[i % PHOTOS.length], file: `${prefix}/${i + 1}` }));
}

const SLIDES = [
  ...set("uk", "the UK", ["london", "manchester"]),
  ...set("north-america", "North America", ["new-york", "toronto", "chicago", "los-angeles"]),
];

async function background(s: Slide) {
  const buf = await sharp(`${ROOT}/brand/november/photos/${s.photo}.jpg`)
    .resize(1080, 1920, { fit: "cover" })
    .jpeg({ quality: 88 })
    .toBuffer();
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

async function render(s: Slide) {
  const bg = await background(s);
  const res = new ImageResponse(
    (
      <div style={{ width: 1080, height: 1920, display: "flex", position: "relative", fontFamily: "Inter", color: "#eef1fb" }}>
        <img src={bg} width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0 }} />
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 1080,
            height: 1920,
            backgroundImage: "linear-gradient(180deg, rgba(5,6,13,0.82) 0%, rgba(5,6,13,0.66) 50%, rgba(5,6,13,0.2) 76%, rgba(5,6,13,0.55) 100%)",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", padding: "380px 100px 0 80px", width: 1080 }}>
          <div style={{ display: "flex", fontSize: 34, letterSpacing: 3, color: "#d8c9ff", textTransform: "uppercase" }}>{s.kicker}</div>
          <div style={{ display: "flex", marginTop: 28, fontFamily: "Fraunces", fontWeight: 600, fontSize: 116, lineHeight: 1.05 }}>{s.title}</div>
          {s.body.map((line) => (
            <div key={line} style={{ display: "flex", marginTop: 40, fontFamily: "Fraunces", fontSize: 56, lineHeight: 1.25 }}>
              {line}
            </div>
          ))}
          {s.accent ? <div style={{ display: "flex", marginTop: 28, fontSize: 52, color: "#f4d9a0" }}>{s.accent}</div> : null}
        </div>
        <div style={{ position: "absolute", left: 80, bottom: 420, display: "flex", fontSize: 26, color: "rgba(238,241,251,0.8)" }}>{s.credit}</div>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
      fonts: [
        { name: "Inter", data: font("inter-400"), weight: 400, style: "normal" },
        { name: "Fraunces", data: font("fraunces-400"), weight: 400, style: "normal" },
        { name: "Fraunces", data: font("fraunces-600"), weight: 600, style: "normal" },
      ],
    },
  );
  const out = path.join(OUT, `${s.file}.png`);
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, Buffer.from(await res.arrayBuffer()));
}

Promise.all(SLIDES.map(render));
