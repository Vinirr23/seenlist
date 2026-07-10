import type { Config } from "tailwindcss";
import { colors } from "@seenlist/config/tailwind-tokens";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors,
      keyframes: {
        "toast-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "press": {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(0.96)" },
          "100%": { transform: "scale(1)" },
        },
        "confetti-fall": {
          "0%": { transform: "translateY(-10dvh) rotate(0deg)", opacity: "1" },
          "100%": { transform: "translateY(90dvh) rotate(360deg)", opacity: "0" },
        },
      },
      animation: {
        "toast-in": "toast-in 200ms ease-out",
        "press": "press 120ms ease-out",
        "confetti-fall": "confetti-fall 2400ms ease-in forwards",
      },
    },
  },
  plugins: [],
};

export default config;
