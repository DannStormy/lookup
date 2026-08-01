import webpush from "web-push";
import type { WebPushSubscription } from "./types";

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
  eventId: string;
}

let configured = false;
function configure(): boolean {
  if (configured) return true;
  const subject = process.env.VAPID_SUBJECT;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

export type SendResult = "ok" | "gone" | "error";

/** Send one push. "gone" means the subscription is dead and should be pruned. */
export async function sendPush(
  sub: WebPushSubscription,
  payload: PushPayload,
): Promise<SendResult> {
  if (!configure()) return "error";
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload), {
      TTL: 1800, // if undelivered in 30 min the moment has passed anyway
      urgency: "high",
    });
    return "ok";
  } catch (err: unknown) {
    const code = (err as { statusCode?: number })?.statusCode;
    if (code === 404 || code === 410) return "gone";
    return "error";
  }
}

export function vapidConfigured(): boolean {
  return configure();
}
