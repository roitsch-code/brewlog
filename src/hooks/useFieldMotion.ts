"use client";

import { useEffect, useRef } from "react";

/**
 * Living-Field motion driver. Writes CSS vars on the Field root; the layers
 * read them, so the Field reacts on the GPU compositor with no React re-render:
 *   --field-drift-x/y   pointer lean (eased)
 *   --field-tilt        pointer rotation
 *   --field-shift-y     scroll parallax — the WHOLE field translates with scroll
 *   --field-pulse       0→1 tap swell
 *   --ptr-x / --ptr-y   pointer position (px) for the finger bloom
 *   --ptr-on            0→1 bloom opacity (finger down/moving → 1, idle → 0)
 * Reduced-motion → no listeners, vars stay neutral. Scroll is caught in the
 * capture phase because ScrollContainer's overflow div doesn't bubble scroll.
 */

const MAX_DRIFT = 22; // px — pointer lean
const MAX_TILT = 2.5; // deg
const SCROLL_PARALLAX = 0.18;
const MAX_SHIFT = 90; // px — parallax clamp (stays within the oversized field)
const GLIDE = 0.08;
const PULSE_GLIDE = 0.12;
const PTR_GLIDE = 0.28; // bloom follows the finger fairly tightly
const ON_GLIDE = 0.14;
const IDLE_MS = 1100;
const EPS = 0.01;

export function useFieldMotion<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let detach: (() => void) | null = null;

    const neutral = () => {
      el.style.setProperty("--field-drift-x", "0px");
      el.style.setProperty("--field-drift-y", "0px");
      el.style.setProperty("--field-tilt", "0deg");
      el.style.setProperty("--field-shift-y", "0px");
      el.style.setProperty("--field-pulse", "0");
      el.style.setProperty("--ptr-on", "0");
    };

    const setup = () => {
      if (mq.matches) {
        neutral();
        return; // reduced motion → no listeners
      }

      let tx = 0;
      let ty = 0;
      let tTilt = 0;
      let pulseTarget = 0;
      let onTarget = 0;
      let tShift = 0;
      let cx = 0;
      let cy = 0;
      let cTilt = 0;
      let pulse = 0;
      let on = 0;
      let shift = 0;
      let px = window.innerWidth / 2;
      let py = window.innerHeight / 2;
      let tpx = px;
      let tpy = py;
      let raf = 0;
      let running = false;
      let idle: ReturnType<typeof setTimeout> | null = null;

      const write = () => {
        el.style.setProperty("--field-drift-x", `${cx.toFixed(2)}px`);
        el.style.setProperty("--field-drift-y", `${cy.toFixed(2)}px`);
        el.style.setProperty("--field-tilt", `${cTilt.toFixed(3)}deg`);
        el.style.setProperty("--field-shift-y", `${shift.toFixed(2)}px`);
        el.style.setProperty("--field-pulse", pulse.toFixed(3));
        el.style.setProperty("--ptr-x", `${px.toFixed(1)}px`);
        el.style.setProperty("--ptr-y", `${py.toFixed(1)}px`);
        el.style.setProperty("--ptr-on", on.toFixed(3));
      };

      const frame = () => {
        cx += (tx - cx) * GLIDE;
        cy += (ty - cy) * GLIDE;
        cTilt += (tTilt - cTilt) * GLIDE;
        pulse += (pulseTarget - pulse) * PULSE_GLIDE;
        on += (onTarget - on) * ON_GLIDE;
        px += (tpx - px) * PTR_GLIDE;
        py += (tpy - py) * PTR_GLIDE;
        shift += (tShift - shift) * GLIDE;
        write();
        const s =
          Math.abs(tx - cx) < EPS &&
          Math.abs(ty - cy) < EPS &&
          Math.abs(tTilt - cTilt) < EPS &&
          Math.abs(pulseTarget - pulse) < EPS &&
          Math.abs(onTarget - on) < EPS &&
          Math.abs(tpx - px) < 0.5 &&
          Math.abs(tpy - py) < 0.5 &&
          Math.abs(tShift - shift) < 0.5;
        if (s) {
          running = false;
          return;
        }
        raf = requestAnimationFrame(frame);
      };
      const kick = () => {
        if (!running) {
          running = true;
          raf = requestAnimationFrame(frame);
        }
      };
      const armIdle = () => {
        if (idle) clearTimeout(idle);
        idle = setTimeout(() => {
          onTarget = 0; // fade the bloom out if the finger goes still
          kick();
        }, IDLE_MS);
      };

      const aim = (clientX: number, clientY: number) => {
        const nx = (clientX / window.innerWidth - 0.5) * 2;
        const ny = (clientY / window.innerHeight - 0.5) * 2;
        tx = nx * MAX_DRIFT;
        ty = ny * MAX_DRIFT;
        tTilt = nx * MAX_TILT;
        tpx = clientX;
        tpy = clientY;
      };
      const onPointerMove = (e: PointerEvent) => {
        aim(e.clientX, e.clientY);
        onTarget = 1;
        armIdle();
        kick();
      };
      const onPointerDown = (e: PointerEvent) => {
        px = tpx = e.clientX; // snap the bloom to the touch immediately
        py = tpy = e.clientY;
        pulseTarget = 1;
        onTarget = 1;
        aim(e.clientX, e.clientY);
        armIdle();
        kick();
      };
      const relax = () => {
        tx = 0;
        ty = 0;
        tTilt = 0;
        pulseTarget = 0;
        onTarget = 0;
        kick();
      };
      const onScroll = (e: Event) => {
        const t = e.target;
        let top = 0;
        if (t instanceof HTMLElement) top = t.scrollTop;
        else if (t instanceof Document) top = t.scrollingElement?.scrollTop ?? 0;
        tShift = Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, -top * SCROLL_PARALLAX));
        kick();
      };

      window.addEventListener("pointermove", onPointerMove, { passive: true });
      window.addEventListener("pointerdown", onPointerDown, { passive: true });
      window.addEventListener("pointerup", relax, { passive: true });
      window.addEventListener("pointercancel", relax, { passive: true });
      document.addEventListener("scroll", onScroll, true);

      detach = () => {
        cancelAnimationFrame(raf);
        if (idle) clearTimeout(idle);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerdown", onPointerDown);
        window.removeEventListener("pointerup", relax);
        window.removeEventListener("pointercancel", relax);
        document.removeEventListener("scroll", onScroll, true);
      };
    };

    setup();
    const onMqChange = () => {
      detach?.();
      detach = null;
      neutral();
      setup();
    };
    mq.addEventListener("change", onMqChange);
    return () => {
      mq.removeEventListener("change", onMqChange);
      detach?.();
    };
  }, []);

  return ref;
}
