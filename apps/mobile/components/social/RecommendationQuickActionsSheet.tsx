import { View, Modal, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Text, Glass } from "@/components/ui";
import { colors, radius, spacing, scrim, fontSize } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * TASK-169 (continuação) — aparece automaticamente ao abrir uma
 * série/filme através de uma recomendação (`?recId=` na rota, ver
 * `app/series/[id].tsx`/`app/movies/[id].tsx`). "Algo simples, sem
 * muito texto" (pedido explícito) — só os botões, sem explicar cada
 * opção. Filme não tem "Começar a assistir" (decisão explícita —
 * filme não tem um status de "assistindo" de verdade, só
 * assistido/assistir depois).
 */
export function RecommendationQuickActionsSheet({
  mediaType,
  onWantToWatch,
  onStartWatching,
  onIgnore,
}: {
  mediaType: "movie" | "series";
  onWantToWatch: () => void;
  onStartWatching: () => void;
  onIgnore: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onIgnore}>
      <View style={styles.overlay}>
        <Glass style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]} variant="dark">
          {/*
            CORREÇÃO (FASE 2, strings hardcoded, 2026-09-26) — os 3
            rótulos eram texto literal. "Assistir depois" reaproveita
            `seriesCategory.wantToWatch` (mesmo texto, mesmo papel —
            categoria "quero assistir", já usada em filtros/sheets de
            outras telas); os outros dois ganharam chave nova, própria
            desta folha.
          */}
          <Pressable style={styles.option} onPress={onWantToWatch}>
            <Feather name="clock" size={18} color={colors.text} />
            <Text style={styles.optionLabel}>{t("seriesCategory.wantToWatch")}</Text>
          </Pressable>

          {mediaType === "series" && (
            <Pressable style={styles.option} onPress={onStartWatching}>
              <Feather name="play" size={18} color={colors.text} />
              <Text style={styles.optionLabel}>{t("social.quickActionStartWatching")}</Text>
            </Pressable>
          )}

          <Pressable style={styles.option} onPress={onIgnore}>
            <Feather name="x" size={18} color={colors.muted} />
            <Text variant="muted" style={styles.optionLabel}>
              {t("social.quickActionIgnore")}
            </Text>
          </Pressable>
        </Glass>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    backgroundColor: scrim.modal,
  },
  // FASE 2 (consistência visual sistêmica, 2026-09-26) — `backgroundColor`
  // sólido saiu (vira `<Glass variant="dark">`, mesmo padrão dos outros
  // sheets do app). `animationType="fade"` (acima) e a ausência de
  // "tocar fora fecha" continuam — diferença estrutural real desta
  // tela (some sozinha ao decidir, não é um bottom sheet de escolha
  // demorada), preservada de propósito.
  sheet: {
    width: "100%",
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.xs,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  // FASE 2 (consistência visual sistêmica, 2026-09-26, decisão do usuário) — token formalizado `fontSize.smPlus` (era literal 15, mesmo valor).
  optionLabel: {
    fontSize: fontSize.smPlus,
    fontWeight: "500",
    color: colors.text,
  },
});
