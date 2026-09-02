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
  const flattened: TextStyle = StyleSheet.flatten([styles[variant], style]) ?? {};
  return <RNText style={[flattened, { fontFamily: fontFamilyForWeight(flattened.fontWeight) }]} {...props} />;
}

const styles = StyleSheet.create({
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
