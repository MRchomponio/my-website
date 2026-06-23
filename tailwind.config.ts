import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: "#0a0a0f",
          surface: "#13131a",
          elevated: "#1a1a24",
          border: "#26262f",
        },
        neon: {
          blue: "#3b82f6",
          "blue-glow": "#60a5fa",
          purple: "#a855f7",
          "purple-glow": "#c084fc",
          green: "#22d3ee",
          "green-glow": "#4ade80",
        },
        foreground: {
          DEFAULT: "#f4f4f6",
          muted: "#9b9ba6",
          subtle: "#6b6b78",
        },
      },
      fontFamily: {
        sans: ["var(--font-vazirmatn)", "Tahoma", "sans-serif"],
      },
      boxShadow: {
        "glow-blue": "0 0 24px rgba(59, 130, 246, 0.35)",
        "glow-purple": "0 0 24px rgba(168, 85, 247, 0.35)",
        "glow-green": "0 0 24px rgba(34, 211, 238, 0.35)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-in-out",
        "slide-up": "slideUp 0.25s ease-out",
        "pulse-glow": "pulseGlow 2.2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseGlow: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
