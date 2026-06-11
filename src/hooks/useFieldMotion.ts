"use client";

import { useEffect, useRef } from "react";

/**
 * Living-Field motion driver (fluidity pass §D).
 *
 * Returns a ref to attach to the Field root. While mounted — and unless the
 * user has Reduce Motion on — it listens to scroll + pointer and writes a
 * handful of CSS custom properties on that root. The blob layers read those
 * vars in their transforms, so the Field reacts to scroll/touch/tap on the GPU
 * compositor without a single React re-render:
 *
 *   --field-drift-x / --field-drift-y  pointer lean (eased glide)
 *   --field-tilt                       pointer-driven rotation
 *   --field-scroll                     scroll-momentum parallax (decays to 0)
 *   --field-pulse                      0→1 swell on press/touch (eases back)
 *
 * Bounded + gentle by construction (a lean, not a lurch). Scroll is caught in
 * the CAPTURE phase at document level because ScrollContainer's overflow div
 * doesn't bubble its scroll and we don't want to touch it.
 */

const MAX_DRIFT = 12; // px — pointer lean
const MAX_TILT = 1.5; // deg
const MAX_SCROLL = 20; // px — parallax travel cap
const GLIDE = 0.06; // pointer/tilt easing per frame (the "fluid" lag)
const PULSE_GLIDE = 0.12; // tap-swell easing per frame
const SCROLL_DECAY = 0.9; // scroll-momentum decay per frame
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
      el.style.setProperty("--field-scroll", "0px");
      el.style.setProperty("--field-pulse", "0");
    };

    const setup = () => {
      if (mq.matches) {
        neutral();
        return; // reduced motion → no listeners, blobs rest in place
      }

      let tx = 0;
      let ty = 0;
      let tTilt = 0;
      let pulseTarget = 0;
      let cx = 0;
      let cy = 0;
      let cTilt = 0;
      let pulse = 0;
      let scroll = 0;
      let lastTop: number | null = null;
      let raf = 0;
      let running = false;

      const frame = () => {
        cx += (tx - cx) * GLIDE;
        cy += (ty - cy) * GLIDE;
        cTilt += (tTilt - cTilt) * GLIDE;
        pulse += (pulseTarget - pulse) * PULSE_GLIDE;
        scroll *= SCROLL_DECAY;
        if (Math.abs(scroll) < 0.1) scroll = 0;

        el.style.setProperty("--field-drift-x", `${cx.toFixed(2)}px`);
        el.style.setProperty("--field-drift-y", `${cy.toFixed(2)}px`);
        el.style.setProperty("--field-tilt", `${cTilt.toFixed(3)}deg`);
        el.style.setProperty("--field-scroll", `${scroll.toFixed(2)}px`);
        el.style.setProperty("--field-pulse", pulse.toFixed(3));

        const settled =
          Math.abs(tx - cx) < EPS &&
          Math.abs(ty - cy) < EPS &&
          Math.abs(tTilt - cTilt) < EPS &&
          Math.abs(pulseTarget - pulse) < EPS &&
          scroll === 0;
        if (settled) {
          running = false;
          return;
        }
        raf = requestAnimationFrame(frame);
      };

      const kick = () => {
        if (running) return;
        running = true;
        raf = requestAnimationFrame(frame);
      };

      const onPointerMove = (e: PointerEvent) => {
        const nx = (e.clientX / window.innerWidth - 0.5) * 2; // -1..1
        const ny = (e.clientY / window.innerHeight - 0.5) * 2;
        tx = nx * MAX_DRIFT;
        ty = ny * MAX_DRIFT;
        tTilt = nx * MAX_TILT;
        kick();
      };
      const onPointerDown = (e: PointerEvent) => {
        pulseTarget = 1; // swell toward the press
        onPointerMove(e);
      };
      const relax = () => {
        tx = 0;
        ty = 0;
        tTilt = 0;
        pulseTarget = 0; // settle back to centre when the finger lifts
        kick();
      };
      const onScroll = (e: Event) => {
        const t = e.target;
        let top = 0;
        if (t instanceof HTMLElement) top = t.scrollTop;
        else if (t instanceof Document) top = t.scrollingElement?.scrollTop ?? 0;
        if (lastTop !== null) {
          scroll += top - lastTop;
          if (scroll > MAX_SCROLL) scroll = MAX_SCROLL;
          else if (scroll < -MAX_SCROLL) scroll = -MAX_SCROLL;
        }
        lastTop = top;
        kick();
      };

      window.addEventListener("pointermove", onPointerMove, { passive: true });
      window.addEventListener("pointerdown", onPointerDown, { passive: true });
      window.addEventListener("pointerup", relax, { passive: true });
      window.addEventListener("pointercancel", relax, { passive: true });
      document.addEventListener("scroll", onScroll, true); // capture — catches the inner scroller

      detach = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerdown", onPointerDown);
        window.removeEventListener("pointerup", relax);
        window.removeEventListener("pointercancel", relax);
        document.removeEventListener("scroll", onScroll, true);
      };
    };

    setup();

    // Re-evaluate live if the user toggles Reduce Motion in Accessibility.
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
