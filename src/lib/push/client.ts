// Browser-side push: register the worker, subscribe, and hand the subscription
// (plus this place) to the server. Kept framework-free so the UI stays thin.

import type { Place } from "../astro/types";
import { DEFAULT_PREFS, type Prefs } from "./types";

const SUB_ID_KEY = "lookup.subid";
const PREFS_KEY = "lookup.prefs";

export function savedPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_PREFS };
}

function storePrefs(prefs: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {}
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (!pushSupported()) return "unsupported";
  return Notification.permission;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function savedSubId(): string | null {
  try {
    return localStorage.getItem(SUB_ID_KEY);
  } catch {
    return null;
  }
}

async function postSubscription(
  sub: PushSubscription,
  place: Place,
  prefs: Prefs,
): Promise<{ id: string }> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      subscription: sub.toJSON(),
      lat: place.lat,
      lon: place.lon,
      label: place.label,
      tz,
      prefs,
    }),
  });
  if (!res.ok) throw new Error("subscribe-failed");
  const data = (await res.json()) as { id: string };
  try {
    localStorage.setItem(SUB_ID_KEY, data.id);
  } catch {}
  storePrefs(prefs);
  return data;
}

/** Register the SW, ask permission, subscribe, and persist server-side. */
export async function subscribe(place: Place, prefs?: Prefs): Promise<{ id: string }> {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) throw new Error("push not configured");

  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("permission-denied");

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
    });
  }
  return postSubscription(sub, place, prefs ?? savedPrefs());
}

/** Update which phenomena a subscribed device wants (re-upserts the record). */
export async function updatePrefs(place: Place, prefs: Prefs): Promise<void> {
  storePrefs(prefs); // optimistic
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await postSubscription(sub, place, prefs);
}

export async function unsubscribe(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await fetch("/api/push/unsubscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
  try {
    localStorage.removeItem(SUB_ID_KEY);
  } catch {}
}

/** Fire a sample push so someone can confirm it reaches their lock screen. */
export async function sendTest(): Promise<boolean> {
  const id = savedSubId();
  if (!id) return false;
  const res = await fetch("/api/push/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id }),
  });
  return res.ok;
}
