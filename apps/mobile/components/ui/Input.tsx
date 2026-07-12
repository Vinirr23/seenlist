import { useState } from "react";
import { TextInput, View, StyleSheet, type TextInputProps } from "react-native";
import { colors, radius, spacing, fontSize } from "@/lib/theme";
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
