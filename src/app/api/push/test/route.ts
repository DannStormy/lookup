import { getStore } from "@/lib/push/store";
import { sendPush } from "@/lib/push/send";

export const dynamic = "force-dynamic";

// Sends a single sample notification to a subscription, so someone can confirm
// alerts actually reach their lock screen before they trust them.
export async function POST(request: Request) {
  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.id) return Response.json({ error: "missing id" }, { status: 400 });

  const store = await getStore();
  const rec = await store.get(body.id);
  if (!rec) return Response.json({ error: "not found" }, { status: 404 });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const res = await sendPush(rec.subscription, {
    title: "Look Up is watching your sky",
    body: "This is how it'll feel. When something rare is about to happen above you, you'll get a tap like this.",
    url: siteUrl.replace(/\/$/, "") + "/",
    tag: "lookup-test",
    eventId: "test",
  });

  if (res === "gone") {
    await store.remove(rec.id);
    return Response.json({ error: "subscription expired" }, { status: 410 });
  }
  return Response.json({ ok: res === "ok" });
}
