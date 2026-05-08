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
        // Each value is a CSS var so :root is the single source of truth.
        dot: {
          base: "var(--bg-base)",
          "warm-mid": "var(--bg-gradient-warm)",
          "warm-peak": "var(--bg-gradient-glow)",
          cool: "var(--bg-gradient-cool)",
          s1: "var(--surface-1)",
          s2: "var(--surface-2)",
          "pill-user": "var(--surface-pill-user)",
          ink: "var(--text-primary)",
          "on-pill": "var(--text-on-pill-user)",
          "ink-soft": "var(--text-secondary)",
          "ink-mute": "var(--text-muted)",
          accent: "var(--text-accent)",
          edge: "var(--border-subtle)",
        },
      },
      fontFamily: {
        serif: ["var(--font-instrument-serif)", "Georgia", "serif"],
        display: ["var(--font-instrument-serif)", "Georgia", "serif"],
        sans: ["var(--font-geist-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "var(--font-jetbrains-mono)", "Fira Code", "monospace"],
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
