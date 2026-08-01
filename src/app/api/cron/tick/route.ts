import { computeSky } from "@/lib/astro/sky";
import type { SkyReport } from "@/lib/astro/types";
import { getStore } from "@/lib/push/store";
import { dueNotifications } from "@/lib/push/schedule";
import { sendPush } from "@/lib/push/send";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  const key = new URL(request.url).searchParams.get("key");
  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically.
  return auth === `Bearer ${secret}` || key === secret;
}

async function tick(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const store = await getStore();
  const subs = await store.all();
  const now = Date.now();
  const at = new Date(now);
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;

  // Reuse one sky computation for everyone near the same spot (~11 km).
  const skyCache = new Map<string, SkyReport>();
  async function skyFor(lat: number, lon: number): Promise<SkyReport> {
    const k = `${lat.toFixed(1)},${lon.toFixed(1)}`;
    let r = skyCache.get(k);
    if (!r) {
      r = await computeSky({ lat, lon, elevation: 0 }, at);
      skyCache.set(k, r);
    }
    return r;
  }

  let sent = 0;
  let pruned = 0;

  for (const rec of subs) {
    let report: SkyReport;
    try {
      report = await skyFor(rec.lat, rec.lon);
    } catch {
      continue;
    }
    const due = dueNotifications(rec, report, now, siteUrl);
    for (const d of due) {
      const res = await sendPush(rec.subscription, d.payload);
      if (res === "ok") {
        await store.markNotified(rec.id, d.key, now);
        sent++;
      } else if (res === "gone") {
        await store.remove(rec.id);
        pruned++;
        break; // this subscription is dead; stop sending to it
      }
    }
  }

  return Response.json({
    ok: true,
    checked: subs.length,
    locations: skyCache.size,
    sent,
    pruned,
    at: at.toISOString(),
  });
}

export const GET = tick;
export const POST = tick;
