/**
 * Tokens de cor globais do SeenList — apenas tema escuro nesta fase
 * (TASK-001). Fonte única de verdade: o Tailwind config de cada app
 * importa deste arquivo em vez de redeclarar os valores, para não
 * duplicar a paleta entre apps/web e apps/mobile.
 *
 * Identidade visual original, não inspirada em nenhuma plataforma
 * de streaming específica.
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
