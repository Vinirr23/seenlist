import { View, Modal, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Text, Glass } from "@/components/ui";
import { colors, radius, spacing, tint, scrim, fontSize } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export interface OptionSheetAction {
  label: string;
  active?: boolean;
  danger?: boolean;
  onPress: () => void;
}

/**
 * CORREÇÃO DE CAUSA RAIZ (2026-09-24, a pedido — "quando seleciono o
 * botão pra marcar toda a temporada... quero que seja um sheet",
 * "quando seleciono um episódio já assistido aparece uma janela,
 * quero que seja um sheet") — este componente é usado nos dois casos
 * (`SeasonAccordion.tsx`: diálogo de temporada/"marcar anteriores"/
 * episódio já assistido; `episodes/[seriesId]/[season]/[episode].tsx`:
 * aviso de comentário em episódio não assistido), mas era um CARTÃO
 * CENTRALIZADO (`Modal animationType="fade"`, `justifyContent:
 * "center"`) — visualmente uma janela de alerta, não um sheet.
 *
 * CORREÇÃO #2 (2026-09-24, mesmo dia, a pedido — "nenhum dos dois está
 * padronizado com os efeitos que uso no resto dos sheets do app") — a
 * primeira versão desta correção trocou o Modal pra `animationType
 * "slide"` + `justifyContent: "flex-end"`, mas manteve um cartão CHAPADO
 * (`backgroundColor: colors.surface`) com um "puxador" inventado (nenhum
 * outro sheet do app tem esse traço cinza no topo). Comparado de novo
 * com `ProfileMoreSheet.tsx` e `SeriesQuickActionsSheet.tsx` — que são
 * a referência real de "sheet" no app —, nenhum dos dois tem puxador, e
 * os dois usam `<Glass variant="dark">` como fundo (o "vidro":
 * `backdrop-blur` + gradiente radial + borda `white/10`, ver
 * `components/ui/Glass.tsx`), não uma cor sólida. Removido o puxador e
 * trocado `View`/`backgroundColor: colors.surface` por `Glass
 * variant="dark"`, valor por valor igual aos outros dois sheets
 * (`borderTopLeftRadius`/`borderTopRightRadius: radius.lg`, `padding:
 * spacing.md`, `paddingBottom: spacing.lg + insets.bottom`).
 */
export function OptionSheet({
  title,
  message,
  actions,
  onDismiss,
}: {
  title: string;
  message?: string;
  actions: OptionSheetAction[];
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onDismiss}>
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <Glass style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]} variant="dark">
            <Text variant="subtitle" style={styles.title}>
              {title}
            </Text>
            {!!message && (
              <Text variant="muted" style={styles.message}>
                {message}
              </Text>
            )}

            <View style={styles.actions}>
              {actions.map((action) => (
                <Pressable
                  key={action.label}
                  style={[styles.actionButton, action.active && styles.actionButtonActive]}
                  onPress={action.onPress}
                >
                  <Text style={action.danger ? styles.actionTextDanger : action.active ? styles.actionTextActive : styles.actionText}>
                    {action.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable style={styles.cancelButton} onPress={onDismiss}>
              <Feather name="x" size={16} color={colors.muted} />
              <Text variant="muted">{t("common.cancel")}</Text>
            </Pressable>
          </Glass>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: scrim.modal,
  },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.md,
  },
  title: {
    textAlign: "center",
  },
  message: {
    marginTop: spacing.xs,
    textAlign: "center",
  },
  actions: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  actionButton: {
    alignItems: "center",
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
  },
  actionButtonActive: {
    backgroundColor: tint.subtle,
  },
  actionText: {
    fontSize: fontSize.sm,
    color: colors.text,
  },
  actionTextActive: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.primary,
  },
  actionTextDanger: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.danger,
  },
  cancelButton: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
  },
});
