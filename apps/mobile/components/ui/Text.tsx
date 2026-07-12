import { Text as RNText, type TextProps as RNTextProps, StyleSheet } from "react-native";
import { colors, fontSize } from "@/lib/theme";

export type TextVariant = "title" | "subtitle" | "body" | "label" | "muted" | "link" | "error";

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
}

/**
 * TASK-090 (fundação nativa) — componente de texto único pro app,
 * pra não espalhar `fontSize`/`color` soltos pelas telas (mesmo
 * espírito do `text-text`/`text-muted` do Tailwind no web: token, não
 * valor solto no meio do componente).
 */
export function Text({ variant = "body", style, ...props }: TextProps) {
  return <RNText style={[styles[variant], style]} {...props} />;
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
