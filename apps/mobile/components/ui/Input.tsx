import { useState } from "react";
import { TextInput, View, StyleSheet, type TextInputProps } from "react-native";
import { colors, radius, spacing, fontSize, fontFamily } from "@/lib/theme";
import { Text } from "./Text";

export interface InputProps extends TextInputProps {
  label: string;
  error?: string | null;
}

/**
 * TASK-090 (fundação nativa) — equivalente nativo do `FormField.tsx`
 * do web. Borda muda de cor no foco (`colors.primary`) pra dar o
 * mesmo feedback visual do `:focus` do CSS, já que RN não tem
 * pseudo-classe — precisa de estado próprio (`isFocused`).
 */
export function Input({ label, error, style, onFocus, onBlur, ...props }: InputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.container}>
      <Text variant="label" style={styles.label}>
        {label}
      </Text>
      <TextInput
        style={[styles.input, isFocused && styles.inputFocused, !!error && styles.inputError, style]}
        placeholderTextColor={colors.muted}
        onFocus={(e) => {
          setIsFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          onBlur?.(e);
        }}
        {...props}
      />
      {!!error && (
        <Text variant="error" style={styles.errorText}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  label: {
    color: colors.muted,
  },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
    // "Plus Jakarta Sans" (a pedido) — `TextInput` não é um `Text`
    // (o componente `Text` de `components/ui`, que resolve a fonte
    // sozinho, não se aplica aqui), precisa declarar na mão. Peso
    // 400 (regular) — é a mesma coisa que este campo já tinha antes
    // (nenhum `fontWeight`, o padrão do sistema já era "normal").
    fontFamily: fontFamily[400],
  },
  inputFocused: {
    borderColor: colors.primary,
  },
  inputError: {
    borderColor: colors.danger,
  },
  errorText: {
    marginTop: 2,
  },
});
