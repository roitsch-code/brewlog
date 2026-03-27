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
          bg: "#0A0A0A",
          surface: "#141414",
          elevated: "#1E1E1E",
          accent: "#F0EDE8",
          muted: "#888888",
          subtle: "#555555",
          border: "#2A2A2A",
          success: "#5A9E5A",
        },
      },
      fontFamily: {
        serif: ["DM Serif Display", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
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
