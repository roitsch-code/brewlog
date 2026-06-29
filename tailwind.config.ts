import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brew: {
          bg: "#0E0B0A",
          surface: "#171311",
          elevated: "#1F1A17",
          accent: "#E8C5A8",
          "accent-fg": "#1A130E",
          muted: "#B8ADA4",
          subtle: "#6B635D",
          border: "#2E2A27",
          success: "#5A9E5A",
        },
        // DOT-inspired redesign tokens (spec: docs/redesign/spec.md §2).
        // Direct hex so Tailwind can apply opacity modifiers (e.g.
        // `bg-dot-s1/50`); :root CSS vars in globals.css mirror these
        // values 1:1 for inline-style consumers — keep in sync.
        dot: {
          base: "#0E0B0A",
          "warm-mid": "#3A2018",
          "warm-peak": "#6B4838",
          cool: "#1A1614",
          s1: "#171311",
          s2: "#1F1A17",
          "pill-user": "#F5ECE5",
          ink: "#F0E8E1",
          "on-pill": "#2E2118",
          "ink-soft": "#B8ADA4",
          "ink-mute": "#6B635D",
          accent: "#E8C5A8",
          edge: "rgba(255,235,220,0.08)",
        },
        // Light System tokens — neutral-anthracite revision.
        // Background (Field gradient + Glass pills) stays warm cream from
        // v1.0 §2.1 / §2.3. Foreground text shifts from the warm brown
        // `hsl(20 14% 12%)` to a neutral anthracite for sharper reading.
        // Borders use the same anthracite at higher opacity so the
        // interactive-surface outlines (Chat input pill, Action Pills,
        // Burger, +, Send, Coffee chip) are clearly defined against the
        // cream Glass.
        light: {
          foreground: "hsl(0 0% 14% / <alpha-value>)",
          // Owner ask (round 2): the light-grey secondary text was hard to read
          // on the now-saturated Field — make it dark/near-black (was 40% grey).
          // Pill text never uses this token (pills use `text-on-dark` cream), so
          // darkening it globally is safe.
          "muted-foreground": "hsl(0 0% 16% / <alpha-value>)",
          "card-default": "hsl(36 55% 96% / 0.55)",
          "card-selected": "hsl(28 22% 84% / 0.7)",
          // Cream label that sits on `bg-light-foreground` (anthracite)
          // pills, CTAs, and the connection status badge. Single source of
          // truth — pre-token there were two near-identical creams
          // (`hsl(36 55% 96%)` on CTA/ConnectionStatus vs `hsl(30 40% 97%)`
          // on ActionPill/ChatInput) which read as subtly different chips.
          "text-on-dark": "hsl(36 55% 96% / <alpha-value>)",
          // Amber accent used by CircularTimer when elapsed > target. Single
          // value, reused for ring, time text, "over" indicator, and the
          // "Done" button background tint.
          "accent-overtime": "hsl(28 95% 45% / <alpha-value>)",
          // Warm rust used for destructive actions (delete brew, swipe-to-
          // delete on SessionCard, delete session inside the café detail
          // edit panel).
          destructive: "hsl(12 70% 45% / <alpha-value>)",
          // Opaque cream — modal/sheet surfaces that need to pop in front
          // of the Field. Distinct from `card-default` (0.55 glass) — this
          // is the solid cream behind the "I've been here" modal so the
          // Field doesn't bleed through a high-decision moment.
          surface: "hsl(36 55% 96%)",
          // Warm-near-black backdrop behind centred modals — dims the rest
          // of the page so the modal cream pops. Use as `bg-light-scrim/45`.
          scrim: "hsl(20 19% 9% / <alpha-value>)",
        },
      },
      fontFamily: {
        serif: ["var(--font-instrument-serif)", "Georgia", "serif"],
        display: ["var(--font-instrument-serif)", "Georgia", "serif"],
        sans: ["var(--font-geist-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "var(--font-jetbrains-mono)", "Fira Code", "monospace"],
        // Light System — Fraunces (hero serif) + Chivo (body sans).
        // Scoped to (light) consumers via explicit `font-fraunces` / `font-chivo`
        // classes so Dark routes keep their existing typography unchanged.
        fraunces: ["var(--font-fraunces)", "ui-serif", "Georgia", "serif"],
        chivo: ["var(--font-chivo)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        sm: "8px",
        md: "14px",
        lg: "22px",
        xl: "28px",
        pill: "999px",
        "4xl": "2rem",
      },
      boxShadow: {
        "glow-subtle": "0 0 60px rgba(232,197,168,0.08)",
        "glow-strong": "0 0 90px rgba(232,197,168,0.18)",
        // Light System v1.0 §2.3, §4.3 — pressed-card inset shadow.
        "light-card-pressed": "inset 0 2px 4px rgba(60, 40, 30, 0.12)",
        // Floating-chrome elevation — warm-dark soft outer lift so the
        // anthracite home controls (Burger, +, round controls, chat bar,
        // Action Pill) read as lifted above the living Field instead of
        // muddying into it. Distinct from the inset pressed-card shadow.
        "light-float": "0 6px 20px -6px rgba(30, 22, 16, 0.28), 0 2px 6px -2px rgba(30, 22, 16, 0.18)",
      },
      backdropBlur: {
        // Light System v1.0 §2.3 — glass blur on cards/sheets/overlays.
        "light-card": "14px",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.32, 0.72, 0, 1)",
      },
      transitionDuration: {
        quick: "160ms",
        base: "240ms",
        slow: "480ms",
      },
      spacing: {
        "safe-bottom": "env(safe-area-inset-bottom)",
        "safe-top": "env(safe-area-inset-top)",
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};

export default config;
