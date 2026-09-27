import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, type PressableProps } from "react-native";
import { colors, radius, spacing } from "@/lib/theme";
import { Text } from "./Text";

export type ButtonVariant = "primary" | "secondary" | "outline";

export interface ButtonProps extends Omit<PressableProps, "children"> {
  children: string;
  variant?: ButtonVariant;
  loading?: boolean;
  /**
   * NOVO (2026-09-22, achado real — o botão "Continuar com Google" no
   * web tem o logo oficial colorido do Google do lado do texto
   * (`components/auth/GoogleButton.tsx` do web, `<GoogleIcon />`); a
   * versão mobile nunca portou isso, só o texto — reportado pelo
   * usuário ao comparar com o botão nativo da Apple, que já vem com
   * ícone por ser componente oficial da Apple. Opcional e sem efeito
   * nenhum nos outros botões do app (todos continuam sem ícone).
   */
  icon?: ReactNode;
}

/**
 * TASK-090 (fundação nativa) — equivalente nativo do `packages/ui/
 * src/Button.tsx` do web (que usa `<button>`/`className`, incompatível
 * com React Native). Mesmos tokens de cor, comportamento próprio de
 * toque (`Pressable`) em vez de CSS `:hover`/`:disabled`.
 */
export function Button({ children, variant = "primary", loading = false, disabled, style, icon, ...props }: ButtonProps) {
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
        <>
          {icon}
          <Text variant="label" style={variant === "primary" ? styles.primaryText : styles.otherText}>
            {children}
          </Text>
        </>
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
