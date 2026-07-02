// Preset compartilhado de ESLint (flat config). Next.js 15 gera
// eslint.config.mjs por padrão — este preset centraliza as regras
// base para não duplicá-las entre apps/web e apps/mobile.
import js from "@eslint/js";
import tseslint from "typescript-eslint";

/** @type {import("eslint").Linter.Config[]} */
export const basePreset = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    ignores: ["**/.next/**", "**/dist/**", "**/.expo/**", "**/node_modules/**"],
  },
];
