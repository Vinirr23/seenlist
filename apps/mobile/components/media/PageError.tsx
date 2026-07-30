import { View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Text, Button } from "@/components/ui";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { colors, spacing } from "@/lib/theme";

export interface PageErrorProps {
  message?: string;
  /** Chamado ao tocar "Tentar de novo" — normalmente o `refetch`/reload da tela. */
  onRetry?: () => void;
}

/**
 * UNIFICAÇÃO (achado real, auditoria de UX) — mesmo problema já
 * corrigido no web: várias telas mostravam erro de rede com a
 * MESMA cara de "lista vazia" (`EmptyShelf`, sem diferença visual
 * nem botão de tentar de novo) — quem via não sabia se a lista
 * estava realmente vazia ou se algo tinha falhado.
 */
export function PageError({ message, onRetry }: PageErrorProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.wrapper}>
      <Feather name="alert-triangle" size={28} color={colors.danger} strokeWidth={1.75} />
      <Text variant="muted" style={styles.message}>
        {message ?? t("error.generic")}
      </Text>
      {!!onRetry && <Button onPress={onRetry}>{t("error.tryAgain")}</Button>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  message: {
    textAlign: "center",
  },
});
