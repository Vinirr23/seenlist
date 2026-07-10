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
    /**
     * Arquivos de configuração de ferramenta (babel, metro, etc.) são
     * CommonJS de verdade, não código da aplicação em TS/ESM — usam
     * `module.exports`/`require`/`__dirname` legitimamente. Sem isso,
     * `no-undef` e `@typescript-eslint/no-require-imports` acusavam
     * erro em arquivo correto, não um bug de aplicação.
     */
    files: ["**/babel.config.js", "**/metro.config.js", "**/*.config.js", "**/*.config.cjs"],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        module: "writable",
        exports: "writable",
        require: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        process: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    ignores: ["**/.next/**", "**/dist/**", "**/.expo/**", "**/node_modules/**"],
  },
];
