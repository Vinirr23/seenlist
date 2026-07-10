/**
 * Tokens de cor globais do SeenList.
 *
 * Ajuste (Configurações — tema): os valores viraram referências a
 * variáveis CSS (`rgb(var(--color-x) / <alpha-value>)`) em vez de
 * hex literal. Isso é o que permite trocar entre escuro/claro em
 * tempo real SEM tocar em nenhum componente do app — todo lugar que
 * já usa `bg-background`, `text-text` etc. continua funcionando
 * exatamente igual; só o que essas classes *resolvem* muda,
 * dependendo da classe `.light`/`.dark` em `<html>` (ver
 * `app/globals.css` pros valores reais de cada tema).
 *
 * Fonte única de verdade: o Tailwind config de cada app importa
 * deste arquivo em vez de redeclarar os valores.
 */
function cssVar(name: string): string {
  return `rgb(var(--color-${name}) / <alpha-value>)`;
}

export const colors = {
  background: cssVar("background"),
  surface: cssVar("surface"),
  primary: cssVar("primary"),
  secondary: cssVar("secondary"),
  text: cssVar("text"),
  muted: cssVar("muted"),
  border: cssVar("border"),
  success: cssVar("success"),
  warning: cssVar("warning"),
  danger: cssVar("danger"),
} as const;

export type ColorToken = keyof typeof colors;
