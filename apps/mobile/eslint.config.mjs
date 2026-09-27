import { basePreset } from "@seenlist/config/eslint-preset";
import reactHooks from "eslint-plugin-react-hooks";

/**
 * CORREÇÃO (limpeza técnica pós-Fase 3, achado — plugin
 * `eslint-plugin-react-hooks` nunca foi registrado, apesar do código
 * já ter `// eslint-disable-next-line react-hooks/exhaustive-deps`
 * espalhado esperando essa regra existir: sem o plugin, virava
 * "Definition for rule ... was not found" em vez de suprimir um lint
 * real — a regra nunca rodou de verdade em nenhum arquivo do app.
 *
 * Registrado SÓ AQUI (não no preset compartilhado `@seenlist/config`)
 * de propósito — `apps/web` já recebe as mesmas duas regras via
 * `next/core-web-vitals` (que traz seu próprio `eslint-plugin-react-hooks`
 * embutido); registrar de novo no preset compartilhado arriscaria dois
 * registros do mesmo plugin colidindo no ESLint 9 (flat config), o que
 * quebraria o lint do web inteiro. `plugins`+`rules` no MESMO objeto —
 * exigência do flat config.
 */
const eslintConfig = [
  ...basePreset,
  {
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];

export default eslintConfig;
