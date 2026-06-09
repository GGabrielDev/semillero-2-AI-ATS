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
        600: "#475569",
        900: "#0f172a",
      },
      blue: {
        600: "#2563eb",
        700: "#1d4ed8",
      },
    },
  },
  plugins: [],
};

export default config;
