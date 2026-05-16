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
          "muted-foreground": "hsl(0 0% 40% / <alpha-value>)",
          "card-default": "hsl(36 55% 96% / 0.55)",
          "card-selected": "hsl(28 22% 84% / 0.7)",
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
