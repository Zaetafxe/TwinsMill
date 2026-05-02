import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        shell: "#0d1b2a",
        panel: "#1b263b",
        steel: "#415a77",
        cloud: "#f1f5f9",
        signal: "#2b6cb0",
        caution: "#f59e0b",
        danger: "#dc2626",
        mint: "#10b981"
      },
      fontFamily: {
        sans: ["Manrope", "Segoe UI", "sans-serif"],
        display: ["Sora", "Manrope", "sans-serif"]
      },
      boxShadow: {
        dashboard: "0 16px 42px rgba(11, 31, 53, 0.28)"
      }
    },
  },
  plugins: [],
};

export default config;
