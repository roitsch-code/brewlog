/**
 * Named gradient values for the BrewLog redesign (spec §2.4).
 *
 * One source of truth — components import these and apply them via inline
 * `style={{ background: ... }}` so they don't depend on Tailwind's JIT
 * scanning `src/lib` (it doesn't — `content` only covers app/components/pages).
 *
 * Reference images: docs/redesign/dot-refs/Splashscreen2_*.png +
 * LoadingScreen_*.png (chat); GradientBackground_*.png (hero).
 */

/**
 * Full chat-surface gradient. Two warm radial stops on the dark base.
 * Use as the wrapper background behind the message scroll area.
 */
export const gradientChatBg =
  "radial-gradient(ellipse 55% 45% at 15% 10%, var(--bg-gradient-glow) 0%, var(--bg-gradient-warm) 35%, var(--bg-base) 75%), radial-gradient(ellipse 60% 50% at 85% 90%, rgba(107,72,56,0.35) 0%, transparent 60%), var(--bg-base)";

/**
 * Tighter hero gradient for the home feed hero card and Phase 4 brew
 * recommend candidates. Single warm stop, less drama than the chat bg.
 */
export const gradientHeroSurface =
  "radial-gradient(ellipse 70% 60% at 30% 20%, var(--bg-gradient-warm) 0%, var(--bg-base) 70%), var(--bg-base)";

/**
 * Subtle warm-on-warm fill for the cream user message bubble — adds
 * dimensionality without breaking the flat-pill read.
 */
export const gradientPillUser =
  "linear-gradient(135deg, #F5ECE5 0%, #EBDFD2 100%)";

/**
 * Primary CTA fill (Phase 2/3 — Brew button, send arrow background).
 */
export const gradientButtonPrimary =
  "linear-gradient(135deg, #F1D2B6 0%, #E8C5A8 60%, #D4A98A 100%)";
