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
          bg: "#111111",
          surface: "#1A1A1A",
          elevated: "#2A2A2A",
          accent: "#D4B896",
          "accent-fg": "#1A1008",
          muted: "#B8B9B6",
          subtle: "#666666",
          border: "#2E2E2E",
          success: "#5A9E5A",
        },
      },
      fontFamily: {
        serif: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        sans: ["var(--font-geist-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "var(--font-jetbrains-mono)", "Fira Code", "monospace"],
      },
      borderRadius: {
        "4xl": "2rem",
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
