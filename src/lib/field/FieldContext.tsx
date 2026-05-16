"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_FIELD_ZONES } from "./defaultZones";
import type { FieldZones } from "./types";

/**
 * Generative Field v1.1 — runtime context.
 *
 * Holds the Field config (zones + step rotation) used by the
 * application-wide <Field /> renderer. The provider lives at the
 * (light) route group root inside LightShell; consumers update it
 * via the useFieldConfig hook from page components or step shells.
 *
 * The state lives in one place so two stacked Fields can't race.
 * Field rendering reads this context and produces a single fixed
 * gradient div for the whole viewport. Pages don't render their own
 * Field — they just declare which composition + rotation they want.
 *
 * Spec rules to respect:
 *  - Hue / saturation / lightness are properties of the coffee
 *    (mapped from tasting notes). Pages must not invent zones —
 *    only pass zones already computed by /api/analyze-bag (or read
 *    from coffees.field_zones once Phase 2b's persistence ships).
 *  - Rotation is the per-step or per-view variation (§8 / §9).
 *  - On unmount, the hook resets to default to prevent a previously-
 *    set field config from leaking into a sibling page.
 */

interface FieldConfig {
  fieldZones: FieldZones;
  rotation: number;
}

interface FieldContextValue extends FieldConfig {
  setFieldConfig: (config: FieldConfig) => void;
}

const DEFAULT_CONFIG: FieldConfig = {
  fieldZones: DEFAULT_FIELD_ZONES,
  rotation: 0,
};

export const FieldContext = createContext<FieldContextValue>({
  ...DEFAULT_CONFIG,
  setFieldConfig: () => {},
});

export function FieldProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<FieldConfig>(DEFAULT_CONFIG);
  const setFieldConfig = useCallback((next: FieldConfig) => setConfig(next), []);

  return (
    <FieldContext.Provider value={{ ...config, setFieldConfig }}>{children}</FieldContext.Provider>
  );
}

/**
 * Page-side hook: declare the Field config for this view. Called from
 * a useEffect-friendly place (the hook handles the effect itself).
 *
 * Unmount resets to default so the next page starts clean — no leak
 * of "previous coffee's Field" when navigating away from a brew flow.
 */
export function useFieldConfig(config: FieldConfig | null | undefined): void {
  const { setFieldConfig } = useContext(FieldContext);
  const stableZones = config?.fieldZones;
  const stableRotation = config?.rotation ?? 0;

  useEffect(() => {
    if (stableZones) {
      setFieldConfig({ fieldZones: stableZones, rotation: stableRotation });
    } else {
      setFieldConfig(DEFAULT_CONFIG);
    }
    return () => setFieldConfig(DEFAULT_CONFIG);
    // Re-run when the actual zones or rotation change. Object identity
    // is a fine equality proxy because callers either pass a stable
    // reference or a freshly-derived one only when the underlying
    // state changes (flowStore drives these).
  }, [stableZones, stableRotation, setFieldConfig]);
}
