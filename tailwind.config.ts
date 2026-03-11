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
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
