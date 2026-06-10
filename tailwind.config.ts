import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    // Overriding the default theme colors to restrict to the whitelist.
    colors: {
      transparent: "transparent",
      current: "currentColor",
      white: "#ffffff",
      slate: {
        50: "#f8fafc",
        200: "#e2e8f0",
        500: "#64748b",
        600: "#475569",
        900: "#0f172a",
      },
      blue: {
        50: "#eff6ff",
        200: "#bfdbfe",
        600: "#2563eb",
        700: "#1d4ed8",
      },
      red: {
        50: "#fef2f2",
        200: "#fecaca",
        600: "#dc2626",
        700: "#b91c1c",
      },
      green: {
        50: "#f0fdf4",
        100: "#dcfce7",
        200: "#bbf7d0",
        700: "#15803d",
        800: "#166534",
      },
    },
  },
  plugins: [],
};

export default config;
