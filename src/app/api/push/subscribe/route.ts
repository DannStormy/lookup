import { getStore, idForEndpoint } from "@/lib/push/store";
import { DEFAULT_PREFS, type Prefs, type PushRecord } from "@/lib/push/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: {
    subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    lat?: number;
    lon?: number;
    label?: string;
    tz?: string;
    prefs?: Partial<Prefs>;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const sub = body.subscription;
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return Response.json({ error: "missing subscription" }, { status: 400 });
  }
  const lat = Number(body.lat);
  const lon = Number(body.lon);
  if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return Response.json({ error: "invalid location" }, { status: 400 });
  }

  const id = idForEndpoint(sub.endpoint);
  const store = await getStore();
  const existing = await store.get(id);

  const rec: PushRecord = {
    id,
    subscription: {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    },
    lat,
    lon,
    label: body.label?.slice(0, 60),
    tz: body.tz?.slice(0, 60),
    prefs: { ...DEFAULT_PREFS, ...(body.prefs ?? {}) },
    createdAt: existing?.createdAt ?? Date.now(),
    notified: existing?.notified ?? {},
  };
  await store.upsert(rec);
  return Response.json({ ok: true, id });
}
