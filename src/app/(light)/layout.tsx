import type { ReactNode } from "react";
import LightShell from "@/components/ui/light/LightShell";

/**
 * (light) route group layout — Light System v1.0 scope.
 *
 * Every page under src/app/(light)/* renders inside <LightShell>, which
 * applies the Field background, Inter as body default, and the warm
 * foreground token (specs/design-system-v1.0.md §1, §2.1, §2.4, §3).
 *
 * Dark routes outside this group keep the root layout's Geist/Instrument
 * Serif stack — no cross-contamination.
 */
export default function LightRouteLayout({ children }: { children: ReactNode }) {
  return <LightShell>{children}</LightShell>;
}
