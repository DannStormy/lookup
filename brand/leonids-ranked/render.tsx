import { Body } from "astronomy-engine";
import { ImageResponse } from "next/og";
import { Fragment, isValidElement } from "react";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { altAz, altAzRaDec, nightWindow, observerOf } from "@/lib/astro/core";
import { estimatedRate } from "@/lib/astro/meteors";
import { moonIlluminationFraction } from "@/lib/astro/moon";
import { getShower, nextPeakNoon, showerForecast } from "@/lib/astro/shower-forecast";
import { CITIES, getCity, type City } from "@/lib/cities";
import { timeIn } from "@/lib/format";

const ROOT = "/Users/dann/Documents/my-proj/lookup";
const OUT = `${ROOT}/brand/leonids-ranked/slides`;
const inter = (w: number) => readFileSync(`${ROOT}/node_modules/@fontsource/inter/files/inter-latin-${w}-normal.woff`);

const CREAM = { bg: "#F4EEE2", ink: "#16132A", soft: "#5D5872", accent: "#C2412D", panel: "#E8DFCC" };
const NAVY = { bg: "#1B1446", ink: "#FFFFFF", soft: "#C9C1EE", accent: "#FFD34D", panel: "#2C2366" };
type Theme = typeof CREAM;
const MEDALS = ["#E2B13C", "#C3C8D0", "#C9824F"];

const leonids = getShower("leonids")!;

// Meteors you could count from dusk to dawn on peak night under a clear, dark sky.
function nightTotal(c: City): number {
  const obs = observerOf({ lat: c.lat, lon: c.lon, elevation: 0 });
  const localNoon = new Date(nextPeakNoon(leonids).getTime() - (c.lon / 15) * 3600e3);
  const { dusk, dawn } = nightWindow(localNoon, obs, -12);
  if (!dusk) return 0;
  const end = dawn ? dawn.getTime() : dusk.getTime() + 12 * 3600e3;
  const lit = moonIlluminationFraction(new Date((dusk.getTime() + end) / 2));
  let total = 0;
  for (let t = dusk.getTime(); t <= end; t += 600e3) {
    const at = new Date(t);
    const radiant = altAzRaDec(leonids.raHours, leonids.decDeg, at, obs);
    const moonUp = altAz(Body.Moon, at, obs).altitude > 0;
    total += estimatedRate(leonids.zhr, radiant.altitude, moonUp, lit) / 6;
  }
  return total;
}

const RANKED = CITIES.map((c) => ({ city: c, total: nightTotal(c) })).sort((a, b) => b.total - a.total);
const rankOf = (slug: string) => RANKED.findIndex((r) => r.city.slug === slug);
const entry = (slug: string) => ({ rank: rankOf(slug) + 1, ...RANKED[rankOf(slug)] });

function lookBefore(slug: string): string {
  const c = getCity(slug)!;
  const f = showerForecast(leonids, { lat: c.lat, lon: c.lon, elevation: 0 });
  return timeIn(f.dawn!, c.tz);
}

// Satori lays a fragment out as its own row, so hand it the fragment's children instead.
const unwrap = (node: React.ReactNode) =>
  isValidElement<{ children: React.ReactNode }>(node) && node.type === Fragment ? node.props.children : node;

const Frame = ({ t, children }: { t: Theme; children: React.ReactNode }) => (
  <div style={{ width: 1080, height: 1920, display: "flex", flexDirection: "column", background: t.bg, color: t.ink, fontFamily: "Inter", padding: "360px 90px 0 90px" }}>
    <div style={{ display: "flex", flexDirection: "column", width: 900 }}>{unwrap(children)}</div>
  </div>
);

const Kicker = ({ t, children }: { t: Theme; children: React.ReactNode }) => (
  <div style={{ display: "flex", fontSize: 40, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: t.accent }}>{children}</div>
);

const Title = ({ children, size = 120 }: { children: React.ReactNode; size?: number }) => (
  <div style={{ display: "flex", flexWrap: "wrap", marginTop: 24, fontSize: size, fontWeight: 900, lineHeight: 1.0, letterSpacing: -3 }}>{children}</div>
);

const Body1 = ({ t, children }: { t: Theme; children: React.ReactNode }) => (
  <div style={{ display: "flex", marginTop: 40, fontSize: 50, fontWeight: 700, lineHeight: 1.25, color: t.soft }}>{children}</div>
);

function Row({ t, rank, name, value, medal }: { t: Theme; rank: number; name: string; value: string; medal?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", marginTop: 16, padding: "14px 30px", borderRadius: 28, background: t.panel }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 92, height: 92, borderRadius: 46, background: medal ?? "transparent", border: medal ? "none" : `5px solid ${t.ink}`, fontSize: 48, fontWeight: 900, color: medal ? "#16132A" : t.ink }}>
        {rank}
      </div>
      <div style={{ display: "flex", flex: 1, marginLeft: 32, fontSize: 56, fontWeight: 800 }}>{name}</div>
      <div style={{ display: "flex", fontSize: 50, fontWeight: 900, color: t.accent }}>{value}</div>
    </div>
  );
}

function rankRows(t: Theme, slugs: string[]) {
  return [...slugs].sort((a, b) => rankOf(a) - rankOf(b)).map((s) => {
    const e = entry(s);
    return <Row key={s} t={t} rank={e.rank} name={e.city.name} value={`${Math.round(e.total)}`} />;
  });
}

function timeRows(t: Theme, slugs: string[]) {
  return slugs.map((s) => (
    <div key={s} style={{ display: "flex", alignItems: "center", marginTop: 14, padding: "16px 34px", borderRadius: 26, background: t.panel }}>
      <div style={{ display: "flex", flex: 1, fontSize: 56, fontWeight: 800 }}>{getCity(s)!.name}</div>
      <div style={{ display: "flex", fontSize: 50, fontWeight: 900, color: t.accent }}>{`before ${lookBefore(s)}`}</div>
    </div>
  ));
}

const total = (slug: string) => Math.round(entry(slug).total);
const last = RANKED[RANKED.length - 1];

const RANKED_SET: { file: string; t: Theme; el: React.ReactNode }[] = [
  {
    file: "ranked/1",
    t: NAVY,
    el: (
      <>
        <Kicker t={NAVY}>Leonids, Tuesday night</Kicker>
        <Title size={150}>{`${CITIES.length} cities ranked`}</Title>
        <Body1 t={NAVY}>By how many meteors you could count from dusk to dawn. Where does yours land?</Body1>
      </>
    ),
  },
  {
    file: "ranked/2",
    t: CREAM,
    el: (
      <>
        <Kicker t={CREAM}>The top 3</Kicker>
        <Title>The far north wins</Title>
        {RANKED.slice(0, 3).map((r, i) => (
          <Row key={r.city.slug} t={CREAM} rank={i + 1} name={r.city.name} value={`${Math.round(r.total)}`} medal={MEDALS[i]} />
        ))}
        <Body1 t={CREAM}>Long November nights keep the shower's radiant up for over six dark hours.</Body1>
      </>
    ),
  },
  {
    file: "ranked/3",
    t: NAVY,
    el: (
      <>
        <Kicker t={NAVY}>UK and Ireland</Kicker>
        <Title size={100}>Every city gets about 60</Title>
        {rankRows(NAVY, ["edinburgh", "glasgow", "manchester", "dublin", "london"])}
        <Body1 t={NAVY}>Glasgow edges it by two. Getting away from street lights matters far more than which city you're in.</Body1>
      </>
    ),
  },
  {
    file: "ranked/4",
    t: CREAM,
    el: (
      <>
        <Kicker t={CREAM}>US and Canada</Kicker>
        <Title size={100}>Canada beats California</Title>
        {rankRows(CREAM, ["edmonton", "seattle", "toronto", "new-york", "chicago", "los-angeles"])}
      </>
    ),
  },
  {
    file: "ranked/5",
    t: NAVY,
    el: (
      <>
        <Kicker t={NAVY}>{`Last place, #${RANKED.length}`}</Kicker>
        <Title>{`Sorry, ${last.city.name}`}</Title>
        <Body1 t={NAVY}>{`South of the equator the radiant barely rises. ${last.city.name} gets about ${Math.round(last.total)} all night, Sydney about ${total("sydney")}.`}</Body1>
      </>
    ),
  },
  {
    file: "ranked/6",
    t: CREAM,
    el: (
      <>
        <Kicker t={CREAM}>Not on here?</Kicker>
        <Title>Comment your city</Title>
        <Body1 t={CREAM}>We'll reply with its rank and the time to look. Counts assume a clear, dark sky. From a city you'll see far fewer.</Body1>
        <div style={{ display: "flex", marginTop: 48, fontSize: 52, fontWeight: 800, color: CREAM.accent }}>lookup.evenfallhq.com</div>
      </>
    ),
  },
];

const GRID_SET: { file: string; t: Theme; el: React.ReactNode }[] = [
  {
    file: "times/1",
    t: CREAM,
    el: (
      <>
        <Kicker t={CREAM}>Leonids, Tuesday night</Kicker>
        <Title size={104}>When to look, UK and Ireland</Title>
        {timeRows(CREAM, ["london", "birmingham", "manchester", "leeds", "glasgow", "edinburgh", "dublin"])}
      </>
    ),
  },
  {
    file: "times/2",
    t: NAVY,
    el: (
      <>
        <Kicker t={NAVY}>Leonids, Tuesday night</Kicker>
        <Title size={104}>When to look, US and Canada</Title>
        {timeRows(NAVY, ["new-york", "toronto", "chicago", "houston", "seattle", "los-angeles", "miami"])}
      </>
    ),
  },
  {
    file: "times/3",
    t: CREAM,
    el: (
      <>
        <Kicker t={CREAM}>How to watch</Kicker>
        <Title>Last dark hour, look up</Title>
        <Body1 t={CREAM}>Go out about an hour before the time on your city. Get away from street lights, give your eyes 20 minutes, and take in the whole sky.</Body1>
        <Body1 t={CREAM}>Your city missing? Comment it.</Body1>
      </>
    ),
  },
];

async function render({ file, t, el }: { file: string; t: Theme; el: React.ReactNode }) {
  const res = new ImageResponse(<Frame t={t}>{el}</Frame>, {
    width: 1080,
    height: 1920,
    fonts: [700, 800, 900].map((w) => ({ name: "Inter", data: inter(w), weight: w as 700 | 800 | 900, style: "normal" as const })),
  });
  const out = path.join(OUT, `${file}.png`);
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, Buffer.from(await res.arrayBuffer()));
}

console.log(RANKED.slice(0, 3).map((r) => `${r.city.name} ${Math.round(r.total)}`).join(", "));
Promise.all([...RANKED_SET, ...GRID_SET].map(render));
