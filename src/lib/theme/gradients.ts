/**
 * Named gradient class strings for the BrewLog redesign (spec §2.4).
 *
 * One source of truth — components import these instead of scattering
 * `bg-[radial-gradient(...)]` literals.
 *
 * Reference images: docs/redesign/dot-refs/Chat_Text_*.png +
 * Chat_Type_*.png (chat); GradientBackground_*.png (hero).
 */

/**
 * Full chat-surface gradient (DOT inversion, May 2026).
 *
 * Soft warm-light surface: cream glow at top-left → warm peach radial at
 * the bottom-center, sitting on a medium warm-taupe base. Designed for
 * dark text on a light surface, matching DOT's chat. Use as the wrapper
 * background behind the message scroll area.
 */
export const gradientChatBg =
  "bg-[radial-gradient(ellipse_70%_55%_at_18%_8%,var(--bg-chat-glow)_0%,transparent_60%),radial-gradient(ellipse_95%_60%_at_50%_105%,var(--bg-chat-warm)_0%,transparent_65%),radial-gradient(ellipse_60%_40%_at_88%_92%,var(--bg-chat-deep)_0%,transparent_70%)] bg-[color:var(--bg-chat-base)]";

/**
 * Tighter hero gradient for the home feed hero card and Phase 4 brew
 * recommend candidates. Single warm stop on the dark base — kept dark
 * because the home feed surface is still on the dark palette.
 */
export const gradientHeroSurface =
  "bg-[radial-gradient(ellipse_70%_60%_at_30%_20%,var(--bg-gradient-warm)_0%,var(--bg-base)_70%)] bg-[color:var(--bg-base)]";

/**
 * User message pill — pure white speech-bubble card with a soft warm
 * shadow, matching DOT's user message (Chat_Text_*.png). Dark text on
 * white reads cleanly over the warm-light chat surface.
 */
export const gradientPillUser =
  "bg-[#FFFFFF]";

/**
 * Primary CTA fill (Phase 2/3 — Brew button, send arrow background).
 */
export const gradientButtonPrimary =
  "bg-[linear-gradient(135deg,#F1D2B6_0%,#E8C5A8_60%,#D4A98A_100%)]";
