/**
 * Named gradient class strings for the BrewLog redesign (spec §2.4).
 *
 * One source of truth — components import these instead of scattering
 * `bg-[radial-gradient(...)]` literals. Each gradient pairs a base radial
 * with optional offset glow rendered via `::before` in the consuming
 * component's wrapper (see Phase 2 primitives).
 *
 * Reference images: docs/redesign/dot-refs/Splashscreen2_*.png +
 * LoadingScreen_*.png (chat); GradientBackground_*.png (hero).
 */

/**
 * Full chat-surface gradient. Two warm radial stops on the dark base.
 * Use as the wrapper background behind the message scroll area.
 *
 * Stops:
 *  - top-left peak  (warm-peak → warm-mid → base) ~55% radius
 *  - bottom-right (warm-mid at low alpha) ~70% radius
 */
export const gradientChatBg =
  "bg-[radial-gradient(ellipse_55%_45%_at_15%_10%,var(--bg-gradient-glow)_0%,var(--bg-gradient-warm)_35%,var(--bg-base)_75%),radial-gradient(ellipse_60%_50%_at_85%_90%,rgba(107,72,56,0.35)_0%,transparent_60%)] bg-[color:var(--bg-base)]";

/**
 * Tighter hero gradient for the home feed hero card and Phase 4 brew
 * recommend candidates. Single warm stop, less drama than the chat bg.
 */
export const gradientHeroSurface =
  "bg-[radial-gradient(ellipse_70%_60%_at_30%_20%,var(--bg-gradient-warm)_0%,var(--bg-base)_70%)] bg-[color:var(--bg-base)]";

/**
 * Subtle warm-on-warm fill for the cream user message bubble — adds
 * dimensionality without breaking the flat-pill read.
 */
export const gradientPillUser =
  "bg-[linear-gradient(135deg,#FBF4ED_0%,#F1E5DA_100%)]";

/**
 * Primary CTA fill (Phase 2/3 — Brew button, send arrow background).
 */
export const gradientButtonPrimary =
  "bg-[linear-gradient(135deg,#F1D2B6_0%,#E8C5A8_60%,#D4A98A_100%)]";
