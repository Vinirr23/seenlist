import { View, Pressable, StyleSheet } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Text, Glass, GelSurface } from "@/components/ui";
import { colors, fontFamily, fontSize, radius, spacing } from "@/lib/theme";

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
    /*
     * PORTE DO WEB (2026-09-09) — a caixa era transparente, sem borda
     * nenhuma. No `EmptyShelf.tsx` do web ela é vidro com borda
     * TRACEJADA (ver a receita `subtle` em `lib/theme.ts`, criada pra
     * isto: é a mais fraca do web e não coincidia com nenhuma
     * existente).
     */
    <Glass style={styles.wrapper} variant="subtle">
      {!!icon && (
        <View style={styles.iconCircle}>
          <Feather name={icon} size={22} color={colors.muted} />
        </View>
      )}
      <Text variant="muted" style={styles.message}>
        {message}
      </Text>
      {hasAction && (
        /*
         * O botão do web é o mesmo "gel" âmbar do resto do app
         * (`radial-gradient(130% 170% at 28% 18%, ...)` + as duas
         * sombras internas), com um `+` de 16px na frente — não o
         * `Button variant="secondary"` que estava aqui.
         */
        <Pressable onPress={() => (onPress ? onPress() : router.push(actionHref!))}>
          <GelSurface style={styles.action} webCalibrated>
            <Feather name="plus" size={16} color={colors.background} />
            <Text style={styles.actionText}>{actionLabel}</Text>
          </GelSurface>
        </Pressable>
      )}
    </Glass>
  );
}

const styles = StyleSheet.create({
  /**
   * Valores do web: `rounded-xl` = 12, `border-dashed`, `gap-3` = 12,
   * `px-4` = 16, `py-8` = 32. Estavam 16 de respiro, 24 de padding
   * lateral e nenhum raio/borda.
   */
  wrapper: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 32,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderStyle: "dashed",
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
  /** `mt-1 rounded-full px-6 py-3 gap-1.5` do web. */
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: radius.full,
  },
  /** `text-sm font-bold text-background`. */
  actionText: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    fontFamily: fontFamily[700],
    color: colors.background,
  },
});
