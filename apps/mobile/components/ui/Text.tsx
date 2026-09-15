import { Text as RNText, type TextProps as RNTextProps, type TextStyle, StyleSheet } from "react-native";
import { colors, fontSize, fontFamilyForWeight } from "@/lib/theme";

export type TextVariant = "title" | "subtitle" | "body" | "label" | "muted" | "link" | "error";

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
}

/**
 * TASK-090 (fundação nativa) — componente de texto único pro app,
 * pra não espalhar `fontSize`/`color` soltos pelas telas (mesmo
 * espírito do `text-text`/`text-muted` do Tailwind no web: token, não
 * valor solto no meio do componente).
 *
 * "Plus Jakarta Sans" (a pedido — "perfil não se parece com o web",
 * ver comentário completo em `lib/theme.ts`, export `fontFamily`) —
 * este é o ÚNICO lugar que resolve `fontFamily` pra tela nenhuma
 * precisar fazer isso na mão. `StyleSheet.flatten` junta o estilo do
 * `variant` com o `style` que cada tela passa (ex.:
 * `<Text style={{ fontWeight: "700" }}>`) ANTES de ler o
 * `fontWeight` final — se lesse só o do `variant`, uma tela pedindo
 * negrito por cima (padrão usado em dezenas de telas) continuaria
 * caindo na fonte "Regular" (RN não sabe fingir negrito numa fonte
 * customizada, só nas do sistema).
 */
export function Text({ variant = "body", style, ...props }: TextProps) {
  const flattened: TextStyle = StyleSheet.flatten([styles[variant], styles.semFolgaDaFonte, style]) ?? {};
  /*
   * CORREÇÃO (2026-09-09, achada portando o `EpisodeCarousel`) — a
   * `fontFamily` derivada do peso vinha DEPOIS do estilo do chamador,
   * então uma tela pedindo uma fonte específica no `style`
   * (`fontFamily: "monospace"`, o `font-mono` do web) era ignorada em
   * silêncio: o valor certo entrava no `flattened` e era sobrescrito
   * na linha seguinte. Agora a derivação por peso só entra quando
   * ninguém pediu fonte nenhuma — que continua sendo o caso de
   * praticamente todas as telas.
   */
  const fonte = flattened.fontFamily ?? fontFamilyForWeight(flattened.fontWeight);
  return <RNText style={[flattened, { fontFamily: fonte }]} {...props} />;
}

const styles = StyleSheet.create({
  /**
   * CORREÇÃO DE RAIZ (2026-09-10, reportado — "distância da bio
   * diferente do web", print real, régua de pixel) — a primeira
   * tentativa (só travar `lineHeight` pra bater com o `mt-4`/
   * `text-lg`/`text-sm` do Tailwind, em `profile.tsx`) NÃO resolveu
   * nada, testado pelo usuário com o Metro reiniciado do zero
   * (`npx expo start -c`) — o que descarta cache e aponta pra uma
   * causa diferente de "linha do texto mal calculada".
   *
   * Causa raiz de verdade: `includeFontPadding` do Android. Todo
   * `TextView` nativo do Android (por baixo do `Text` do RN) soma,
   * por padrão, uma folga EXTRA acima/abaixo do texto (baseada na
   * métrica bruta da fonte — pensada pra acentos/diacríticos), POR
   * CIMA de qualquer `lineHeight` que a gente defina. Essa folga não
   * existe no iOS nem no navegador (web usa CSS puro, sem esse
   * conceito) — só no Android, exatamente a plataforma testada aqui
   * (emulador Android). É um problema conhecido e documentado do RN
   * no Android, não uma suposição: <https://reactnative.dev/docs/text#includefontpadding>.
   * `includeFontPadding: false` desliga essa folga — junto com o
   * `lineHeight` já certo (travado em `profile.tsx`), o texto passa a
   * ocupar só a caixa que o `lineHeight` diz, igual ao web.
   *
   * Aplicado aqui na BASE (todas as variantes), não só no Perfil,
   * porque a mesma causa afeta QUALQUER texto do app no Android —
   * escopo pequeno e reversível (só some uma folga invisível, não
   * muda tamanho de fonte nem quebra de linha), mas o efeito é
   * sistêmico por natureza.
   */
  semFolgaDaFonte: {
    includeFontPadding: false,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: "700",
    color: colors.text,
  },
  subtitle: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: colors.text,
  },
  body: {
    fontSize: fontSize.md,
    fontWeight: "400",
    color: colors.text,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text,
  },
  muted: {
    fontSize: fontSize.sm,
    fontWeight: "400",
    color: colors.muted,
  },
  link: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.primary,
  },
  error: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: colors.danger,
  },
});
