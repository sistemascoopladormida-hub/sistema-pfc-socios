import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/modules/**/*.{ts,tsx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        coopGreen: "#10B981",
        coopBlue: "#2563EB",
        coopSecondary: "#1E40AF",
        coopPurple: "#6C4AA1",
        coopOrange: "#F1872D",
        coopGray: "#F5F7FA",
        coopWarning: "#F59E0B",
        coopError: "#EF4444",
        pfc: {
          50: "#EAF6F2",
          100: "#D6EEE6",
          200: "#A9DDCD",
          300: "#7BCBB3",
          400: "#4EB99A",
          500: "#229981",
          600: "#0D6E5A",
          700: "#0B5B4B",
          800: "#0A473B",
          900: "#0A1F1A",
          950: "#061510",
        },
        pfcSurface: "#F7F8F6",
        pfcBorder: "#E8EBE9",
        pfcText: {
          primary: "#0F1C18",
          secondary: "#4A5C55",
          muted: "#8FA89F",
        },
      },
      boxShadow: {
        "pfc-card": "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
        "pfc-card-hover": "0 8px 24px rgba(0,0,0,0.08)",
      },
      maxWidth: {
        "pfc-content": "1280px",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
