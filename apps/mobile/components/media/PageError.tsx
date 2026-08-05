import { View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Text, Button } from "@/components/ui";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { useOnlineStatus } from "@/lib/useOnlineStatus";
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
  const isOnline = useOnlineStatus();

  /**
   * CORREÇÃO (a pedido — auditoria de UX) — antes, TODA falha
   * mostrava a mesma frase genérica ("Algo deu errado"), sem
   * distinguir "seu celular está sem internet" de "nosso servidor
   * falhou". São situações com AÇÕES diferentes: numa, a pessoa
   * checa o Wi-Fi; na outra, só resta esperar. O app já sabia
   * detectar falta de conexão (`useOnlineStatus`, usado no
   * `OfflineBanner`) — só nunca tinha sido usado aqui. Estar
   * offline vence a mensagem específica da tela: não adianta dizer
   * "não foi possível carregar sua biblioteca" quando o problema é
   * que não há internet nenhuma.
   */
  const displayMessage = !isOnline ? t("error.offline") : (message ?? t("error.generic"));

  return (
    <View style={styles.wrapper}>
      <Feather name={isOnline ? "alert-triangle" : "wifi-off"} size={28} color={colors.danger} strokeWidth={1.75} />
      <Text variant="muted" style={styles.message}>
        {displayMessage}
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
