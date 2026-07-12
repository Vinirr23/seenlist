import { ActivityIndicator, Pressable, StyleSheet, type PressableProps } from "react-native";
import { colors, radius, spacing } from "@/lib/theme";
import { Text } from "./Text";

export type ButtonVariant = "primary" | "secondary" | "outline";

export interface ButtonProps extends Omit<PressableProps, "children"> {
  children: string;
  variant?: ButtonVariant;
  loading?: boolean;
}

/**
 * TASK-090 (fundação nativa) — equivalente nativo do `packages/ui/
 * src/Button.tsx` do web (que usa `<button>`/`className`, incompatível
 * com React Native). Mesmos tokens de cor, comportamento próprio de
 * toque (`Pressable`) em vez de CSS `:hover`/`:disabled`.
 */
export function Button({ children, variant = "primary", loading = false, disabled, style, ...props }: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      style={(state) => [
        styles.base,
        variantStyles[variant],
        isDisabled && styles.disabled,
        state.pressed && !isDisabled && styles.pressed,
        typeof style === "function" ? style(state) : style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? colors.background : colors.primary} size="small" />
      ) : (
        <Text variant="label" style={variant === "primary" ? styles.primaryText : styles.otherText}>
          {children}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.5,
  },
  primaryText: {
    color: colors.background,
  },
  otherText: {
    color: colors.text,
  },
});

const variantStyles = StyleSheet.create({
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.surface,
  },
  outline: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
