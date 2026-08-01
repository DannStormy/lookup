"use client";

import { useEffect, useRef } from "react";

/**
 * A quiet field of stars on a canvas. They drift almost imperceptibly and
 * breathe. Meant to be felt, not noticed. Fixed behind all content.
 */
export default function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let stars: {
      x: number;
      y: number;
      r: number;
      base: number;
      tw: number;
      phase: number;
    }[] = [];
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function seed() {
      w = canvas!.clientWidth;
      h = canvas!.clientHeight;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.floor((w * h) / 5200);
      stars = Array.from({ length: count }, () => {
        const y = Math.random();
        return {
          x: Math.random() * w,
          // fewer, dimmer stars near the horizon (bottom)
          y: y * h,
          r: Math.random() * 1.1 + 0.25,
          base: (1 - y * 0.55) * (Math.random() * 0.5 + 0.35),
          tw: Math.random() * 0.5 + 0.2,
          phase: Math.random() * Math.PI * 2,
        };
      });
    }

    function draw(t: number) {
      ctx!.clearRect(0, 0, w, h);
      for (const s of stars) {
        const flicker = reduce
          ? s.base
          : s.base + Math.sin(t * 0.001 * s.tw + s.phase) * 0.18;
        const a = Math.max(0, Math.min(1, flicker));
        ctx!.beginPath();
        ctx!.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(238, 241, 251, ${a})`;
        ctx!.fill();
        // a faint halo on the brightest few
        if (s.r > 1.05) {
          ctx!.beginPath();
          ctx!.arc(s.x, s.y, s.r * 2.4, 0, Math.PI * 2);
          ctx!.fillStyle = `rgba(244, 217, 160, ${a * 0.06})`;
          ctx!.fill();
        }
      }
      if (!reduce) raf = requestAnimationFrame(draw);
    }

    seed();
    draw(0);
    if (reduce) draw(0);

    const onResize = () => {
      seed();
      if (reduce) draw(0);
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 h-full w-full"
      style={{ zIndex: 0 }}
    />
  );
}
