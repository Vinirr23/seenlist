import { View, StyleSheet } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Text, Button } from "@/components/ui";
import { colors, spacing } from "@/lib/theme";

/**
 * CORREÇÃO (a pedido — auditoria de consistência) — achado real: o
 * app tinha DOIS padrões de estado vazio convivendo. Uns usavam este
 * componente (mensagem centralizada + botão de ação); outros, mais de
 * dez, eram um `<Text variant="muted">` solto, cada um com sua
 * própria centralização e espaçamento — em alguns casos nem
 * centralizado, colado no canto. Estado vazio é onde o usuário mais
 * precisa de direção (conta nova = tudo vazio), e era o lugar menos
 * consistente do app.
 *
 * Ampliado pra cobrir TODOS os casos, e assim virar o padrão único:
 * - `icon`: peso visual, pra não ser só uma frase perdida no vazio.
 * - `onPress`: ação que não é navegação (abrir uma folha, por
 *   exemplo) — antes só dava pra navegar.
 * - `actionHref`: agora aceita qualquer rota (era travado só em
 *   `/(tabs)/explore`, o que forçava as outras telas a não usar o
 *   componente).
 * - Sem ação nenhuma continua válido: nem todo vazio tem um próximo
 *   passo óbvio.
 */
export function EmptyShelf({
  message,
  actionLabel,
  actionHref,
  onPress,
  icon,
}: {
  message: string;
  actionLabel?: string;
  actionHref?: Href;
  onPress?: () => void;
  icon?: keyof typeof Feather.glyphMap;
}) {
  const router = useRouter();
  const hasAction = !!actionLabel && (!!actionHref || !!onPress);

  return (
    <View style={styles.wrapper}>
      {!!icon && (
        <View style={styles.iconCircle}>
          <Feather name={icon} size={22} color={colors.muted} />
        </View>
      )}
      <Text variant="muted" style={styles.message}>
        {message}
      </Text>
      {hasAction && (
        <Button variant="secondary" onPress={() => (onPress ? onPress() : router.push(actionHref!))}>
          {actionLabel}
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  message: {
    textAlign: "center",
  },
});
