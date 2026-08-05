/**
 * TASK-090 (fundação nativa) — tokens de cor pro app mobile.
 *
 * O web resolve cores em tempo real via CSS var (ver
 * `packages/config/src/tailwind-tokens.ts` + `globals.css`), pra
 * suportar tema claro/escuro trocável sem rebuild. React Native não
 * tem CSS var — os valores aqui são os hex FIXOS do tema escuro
 * (`:root, .dark` em globals.css), que é o único tema que o app
 * mobile usa por enquanto (`"userInterfaceStyle": "dark"` em
 * app.json). Se um dia o mobile ganhar tema claro, este arquivo vira
 * um objeto com as duas paletas + um hook de tema — não antes disso.
 *
 * Fonte única de verdade pros valores: apps/web/app/globals.css.
 */
export const colors = {
  background: "#0B0E14",
  surface: "#131826",
  primary: "#E8A33D",
  secondary: "#4FD1C5",
  text: "#F4F1E8",
  muted: "#8C93A8",
  border: "#262D40",
  success: "#34C77B",
  warning: "#F0B429",
  danger: "#E8574A",
} as const;

export type ColorToken = keyof typeof colors;

/** Escala de espaçamento simples — múltiplos de 4, igual ao ritmo do Tailwind do web (space-4 = 16px etc.). */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 999,
} as const;

/**
 * CORREÇÃO (a pedido — auditoria visual, "profundidade/sombra") —
 * achado real: de todo o app, só 4 arquivos usavam sombra, cada um
 * com valor diferente "no olho" (sem escala) — os mais de 10
 * componentes de card do app (pôster, review, post, comentário)
 * eram completamente planos, só cor+borda. Escala de elevação nova,
 * 3 níveis (baixo → alto), pra usar em vez de inventar valor solto
 * de novo — mesma disciplina do `spacing`/`radius`/`fontSize`.
 * Espelhada no web (`app/globals.css`, classes `.shadow-card-*`)
 * pras duas plataformas ficarem com a mesma sensação de profundidade.
 */
export const elevation = {
  low: {
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  medium: {
    shadowColor: "#000",
    shadowOpacity: 0.24,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  high: {
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
} as const;
