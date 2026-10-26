import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        durbs: {
          yellow: "#FFE600",
          pink: "#FF2E93",
          cyan: "#00F0FF",
          purple: "#8A2BE2",
        },
      },
      borderWidth: {
        3: "3px",
      },
      boxShadow: {
        brutal: "4px 4px 0px 0px rgba(0,0,0,1)",
        "brutal-lg": "6px 6px 0px 0px rgba(0,0,0,1)",
        "brutal-xl": "10px 10px 0px 0px rgba(0,0,0,1)",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
