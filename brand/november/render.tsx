import { ImageResponse } from "next/og";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = "/Users/dann/Documents/my-proj/lookup";
const OUT = `${ROOT}/brand/november/slides`;
const font = (f: string) => readFileSync(`${ROOT}/src/app/api/card/${f}.woff`);

type Slide = {
  file: string;
  photo: string;
  focus?: string;
  credit: string;
  kicker: string;
  title: string;
  body: string[];
  accent?: string;
};

const INGALLS = "Photo: NASA/Bill Ingalls";

const SLIDES: Slide[] = [
  {
    file: "1-hook",
    photo: "NHQ202108100009",
    credit: INGALLS,
    kicker: "November 2026",
    title: "4 nights to look up this month",
    body: ["No telescope needed."],
  },
  {
    file: "2-venus",
    photo: "NHQ202508030001",
    credit: `${INGALLS}, Perseid meteor, 2025`,
    kicker: "Saturday, Nov 7, before dawn",
    title: "Venus beside a thin Moon",
    body: ["Look low in the southeast about 45 minutes before sunrise."],
  },
  {
    file: "3-leonids",
    photo: "NHQ202108110005",
    credit: `${INGALLS}, Perseid shower, 2021`,
    kicker: "Monday night, Nov 16, into Tuesday",
    title: "The Leonids peak",
    body: ["Best in the last dark hour before dawn.", "Up to about 14 meteors an hour under a dark sky. Far fewer from a city."],
  },
  {
    file: "4-saturn",
    photo: "NHQ202108110001",
    credit: INGALLS,
    kicker: "Friday, Nov 20, after dark",
    title: "The Moon near Saturn",
    body: ["Look southeast. Saturn is the steady point of light a few finger widths from the Moon."],
  },
  {
    file: "5-full-moon",
    photo: "201306230001HQ",
    credit: `${INGALLS}, supermoon, 2013`,
    kicker: "Tuesday, Nov 24",
    title: "A full supermoon",
    body: ["It rises around sunset, closer to Earth than average."],
  },
  {
    file: "6-your-city",
    photo: "NHQ202108110003",
    credit: `${INGALLS}, Perseid shower, 2021`,
    kicker: "Where you are",
    title: "Comment your city",
    body: ["We'll tell you when and where to look.", "Or check any night for free:"],
    accent: "lookup.evenfallhq.com",
  },
];

async function background(s: Slide) {
  const buf = await sharp(`${ROOT}/brand/november/photos/${s.photo}.jpg`)
    .resize(1080, 1920, { fit: "cover", position: s.focus ?? "centre" })
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
            backgroundImage: "linear-gradient(180deg, rgba(5,6,13,0.82) 0%, rgba(5,6,13,0.62) 45%, rgba(5,6,13,0.15) 72%, rgba(5,6,13,0.55) 100%)",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", padding: "380px 130px 0 80px", width: 1080 }}>
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
  writeFileSync(path.join(OUT, `${s.file}.png`), Buffer.from(await res.arrayBuffer()));
}

mkdirSync(OUT, { recursive: true });
Promise.all(SLIDES.map(render));
