# Look Up

The rare, beautiful things happening in the sky right above your exact spot tonight, and the precise minute to look up.

Point it at a location and it computes tonight's real sky from live data: the space station's visible passes (SGP4 orbital mechanics + real TLEs from CelesTrak), **ISS transits of the moon and sun** (the exact second the station crosses the disc, from your exact spot), the moon's phase and position, bright visible planets, meteor-shower quality from radiant altitude, aurora likelihood from live NOAA space weather, close conjunctions, **naked-eye comets** (Keplerian orbits from live MPC elements), and **freshly launched Starlink trains**. No API keys. Free, no signup, works anywhere on Earth.

## Phenomena engine

- **ISS passes** — `iss.ts`: visible passes (sunlit satellite + observer in darkness + above 10°).
- **ISS transits** — `transits.ts`: the station crossing the lunar/solar disc, found by coarse-then-fine-then-0.02s refinement. Sub-second, and the visible path is only a few km wide, so most spots see none for months. Validated by finding a real solar-transit centerline (62 adjacent locations forming a clean ground track, durations 0.3–0.7s).
- **Comets** — `comets.ts` + `comet-kepler.ts`: a real Keplerian propagator (elliptical / near-parabolic Barker / hyperbolic) fed by live MPC `CometEls.txt`, with the standard apparent-magnitude formula and per-observer visibility. Nothing is hardcoded as "visible." Validated against NEOWISE (0.69 AU closest approach on 2020-07-23, matching reality) and Halley (perihelion r = q).
- **Starlink trains** — `starlink.ts`: finds the freshest still-clustered, still-low batch (CelesTrak `last-30-days`, grouped by launch designator, mean motion > 15.5) and checks for a visible pass.

## Stack

- Next.js 16 (App Router) + React 19 + Tailwind v4, TypeScript
- `astronomy-engine` (sky geometry), `satellite.js` (SGP4 passes)
- Engine: `src/lib/astro/*`, assembler `sky.ts`, API `GET /api/sky?lat&lon`
- UI: `src/components/*` (calm dark celestial, Fraunces serif, canvas starfield, "where to look" compass)
- Share cards: `GET /api/card?lat&lon&name` renders a 1200x630 social image; `/?lat&lon&name` deep-links + unfurls
- Web Push: `src/lib/push/*`, service worker `public/sw.js`, routes `POST /api/push/{subscribe,unsubscribe,test}`, scheduler `GET /api/cron/tick`. Subscriptions live in Upstash Redis in prod (local file store in dev). Installable PWA.

## The push loop

1. A browser subscribes: service worker + VAPID key, and we store the subscription with its location and preferences.
2. A cron hits `/api/cron/tick` every few minutes. For each subscriber it computes the sky at their spot and finds events that are *due*: an ISS pass beginning within their lead time, or a rare aurora/meteor peak while it's dark where they are.
3. It sends a value-carrying push ("Look up in about 8 minutes. The space station is rising in the northeast, brighter than any star. Go outside and look."), dedupes so it never nags twice, and prunes dead subscriptions.

## Develop

```bash
npm run dev
```

## Deploy (Vercel)

```bash
npm i -g vercel
vercel
```

Then set the environment variables (see `.env.example` for the full annotated list):

- `NEXT_PUBLIC_SITE_URL` — your deployed origin, e.g. `https://lookup.app`, no trailing slash. Makes share-card `og:image` URLs absolute.
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` — web push keys. Generate with `npx web-push generate-vapid-keys`.
- `CRON_SECRET` — protects the tick endpoint. `openssl rand -hex 24`.
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — a free Upstash Redis for durable subscriptions (the local file store is not durable on Vercel). Create at upstash.com.

### Cron cadence

There is no `vercel.json` cron, because Vercel **Hobby** rejects any deploy whose
cron runs more than once a day. Instead, drive the tick with a free external
scheduler (cron-job.org or Upstash QStash) pointed at:

```
https://YOUR_SITE/api/cron/tick?key=YOUR_CRON_SECRET
```

every 2–3 minutes. On **Vercel Pro** you can instead add a `vercel.json` with
`{ "crons": [{ "path": "/api/cron/tick", "schedule": "*/3 * * * *" }] }`.

## Not built yet (roadmap)

- Look Up+ (Paddle, ~$15/yr): guaranteed rare-event alerts, clear-sky/cloud-cover confirmation, saved locations, custom lead time. The push backbone and paywall-gating are the natural next step.
- Preferences UI (toggle which event kinds alert you; quiet hours using the stored timezone).
