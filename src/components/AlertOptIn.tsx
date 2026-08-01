"use client";

import { useEffect, useState } from "react";
import type { Place } from "@/lib/astro/types";
import { DEFAULT_PREFS, PREF_LABELS, type PrefKey, type Prefs } from "@/lib/push/types";
import {
  isIOS,
  isStandalone,
  notificationPermission,
  pushSupported,
  savedPrefs,
  savedSubId,
  sendTest,
  subscribe,
  unsubscribe,
  updatePrefs,
} from "@/lib/push/client";

type UI =
  | "loading"
  | "unsupported"
  | "ios-install"
  | "ready" // supported, not yet on
  | "working"
  | "on"
  | "denied";

function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className="relative h-[24px] w-[42px] shrink-0 rounded-full border transition-colors"
      style={{
        borderColor: on ? "rgba(244,217,160,0.55)" : "var(--line)",
        background: on ? "rgba(244,217,160,0.22)" : "rgba(255,255,255,0.03)",
      }}
    >
      <span
        className="absolute top-[2px] h-[18px] w-[18px] rounded-full transition-all"
        style={{
          left: on ? "21px" : "2px",
          background: on ? "var(--starlight)" : "var(--ink-dim)",
        }}
      />
    </button>
  );
}

export default function AlertOptIn({ place }: { place: Place }) {
  const [ui, setUi] = useState<UI>("loading");
  const [tested, setTested] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);

  useEffect(() => {
    setPrefs(savedPrefs());
    if (!pushSupported()) {
      if (isIOS() && !isStandalone()) setUi("ios-install");
      else setUi("unsupported");
      return;
    }
    const perm = notificationPermission();
    if (perm === "denied") setUi("denied");
    else if (perm === "granted" && savedSubId()) setUi("on");
    else setUi("ready");
  }, []);

  async function turnOn() {
    setUi("working");
    try {
      await subscribe(place, prefs);
      setUi("on");
    } catch (e) {
      const msg = (e as Error).message;
      setUi(msg === "permission-denied" ? "denied" : "ready");
    }
  }

  async function turnOff() {
    await unsubscribe();
    setUi("ready");
    setTested(false);
  }

  async function test() {
    const ok = await sendTest();
    setTested(ok);
  }

  function toggle(key: PrefKey) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    updatePrefs(place, next).catch(() => {});
  }

  const placeName = place.label ?? "this spot";

  if (ui === "loading") return null;

  if (ui === "on") {
    return (
      <div className="mt-8 rounded-2xl border border-[var(--line)] bg-white/[0.02] p-5">
        <p className="text-[15px] text-ink">
          <span className="text-starlight">Alerts are on for {placeName}.</span> Tap
          you about:
        </p>

        <ul className="mt-4 flex flex-col divide-y divide-[var(--line)]">
          {PREF_LABELS.map(({ key, label, note }) => (
            <li key={key} className="flex items-center gap-4 py-3">
              <span className="flex-1">
                <span className="block text-[15px] text-ink">{label}</span>
                <span className="mt-0.5 block text-xs leading-snug text-ink-dim">{note}</span>
              </span>
              <Toggle on={prefs[key] !== false} onChange={() => toggle(key)} label={label} />
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-center gap-4 text-[13px]">
          <button onClick={test} className="text-ink-soft underline-offset-4 hover:text-starlight hover:underline">
            {tested ? "Test sent" : "Send a test"}
          </button>
          <button onClick={turnOff} className="text-ink-dim underline-offset-4 hover:text-ink-soft hover:underline">
            Turn off alerts
          </button>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-ink-dim">
          To time these, your location is stored on our server while alerts are on,
          and deleted the moment you turn them off. Nothing is shared with anyone.
        </p>
      </div>
    );
  }

  if (ui === "ready" || ui === "working") {
    return (
      <div className="mt-8">
        <button
          onClick={turnOn}
          disabled={ui === "working"}
          className="cta rounded-full px-6 py-3 text-[15px] font-medium disabled:opacity-60"
        >
          {ui === "working" ? "Turning on…" : "Wake me the moment it's overhead"}
        </button>
        <p className="mt-2 text-xs leading-relaxed text-ink-dim">
          A tap on the shoulder at the exact minute, even when the app is closed. No
          account, no email. This stores your location on our server so we can time
          the alerts; turn them off any time to delete it.
        </p>
      </div>
    );
  }

  if (ui === "ios-install") {
    return (
      <div className="mt-8 rounded-2xl border border-[var(--line)] bg-white/[0.02] p-5 text-[14px] leading-relaxed text-ink-soft">
        To get a tap the moment something&apos;s overhead, add Look Up to your home
        screen first: tap the share button, then <span className="text-ink">Add to Home Screen</span>.
        Open it from there and alerts can reach you.
      </div>
    );
  }

  if (ui === "denied") {
    return (
      <p className="mt-8 text-[14px] text-ink-dim">
        Notifications are blocked for this site in your browser settings, so alerts
        can&apos;t reach you. You can re-enable them there anytime.
      </p>
    );
  }

  return (
    <p className="mt-8 text-[14px] text-ink-dim">
      This browser can&apos;t do live sky alerts. Open Look Up in Chrome, Edge, or
      Safari to be tapped the moment something&apos;s overhead.
    </p>
  );
}
