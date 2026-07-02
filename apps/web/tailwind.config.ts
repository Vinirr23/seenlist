import type { Config } from "tailwindcss";
import { colors } from "@seenlist/config/tailwind-tokens";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors,
    },
  },
  plugins: [],
};

export default config;
