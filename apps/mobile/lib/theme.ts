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
/**
 * CORREÇÃO (a pedido — auditoria de consistência) — achado real: a
 * cor da marca aparecia escrita à mão (`rgba(232,163,61,...)`) em
 * 14 lugares, com NOVE opacidades diferentes (0.05, 0.06, 0.1,
 * 0.12, 0.15, 0.16, 0.25, 0.4, 0.6) — quase sempre pra mesma coisa:
 * "fundo sutil de item selecionado/destacado". Isso é invisível item
 * a item, mas somado é o que faz um app parecer montado por pessoas
 * diferentes. Três tons oficiais agora, pra usar em vez de inventar
 * uma opacidade nova a cada tela.
 */
/**
 * CORREÇÃO (a pedido — auditoria de consistência) — achado real:
 * "véu escuro" (fundo de modal, camada sobre imagem, fundo de botão
 * flutuante sobre pôster) aparecia 28 vezes escrito à mão, com DEZ
 * valores diferentes — e misturando duas cores base (`#000` puro em
 * uns lugares, a cor de fundo do app `#0B0E14` em outros), o que dá
 * temperaturas visivelmente diferentes lado a lado. Três papéis
 * definidos agora:
 */
export const scrim = {
  /** Fundo de modal/bottom sheet — escurece a tela inteira atrás. */
  modal: "rgba(0,0,0,0.6)",
  /** Camada sobre imagem, pra texto ficar legível por cima (capa, backdrop). */
  overImage: "rgba(11,14,20,0.7)",
  /** Fundo de controle flutuante sobre imagem (botão de voltar, "+" no pôster). */
  control: "rgba(11,14,20,0.75)",
} as const;

export const tint = {
  /** Fundo sutil de item selecionado/ativo (linha de lista, chip, opção escolhida). */
  subtle: "rgba(232,163,61,0.12)",
  /** Preenchimento com mais presença — barra de resultado de enquete, destaque forte. */
  strong: "rgba(232,163,61,0.25)",
  /** Borda de item destacado (nunca fundo). */
  border: "rgba(232,163,61,0.4)",
} as const;

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
