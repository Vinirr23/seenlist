import { View, Modal, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Text } from "@/components/ui";
import { colors, radius, spacing } from "@/lib/theme";

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
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onIgnore}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Pressable style={styles.option} onPress={onWantToWatch}>
            <Feather name="clock" size={18} color={colors.text} />
            <Text style={styles.optionLabel}>Assistir depois</Text>
          </Pressable>

          {mediaType === "series" && (
            <Pressable style={styles.option} onPress={onStartWatching}>
              <Feather name="play" size={18} color={colors.text} />
              <Text style={styles.optionLabel}>Começar a assistir</Text>
            </Pressable>
          )}

          <Pressable style={styles.option} onPress={onIgnore}>
            <Feather name="x" size={18} color={colors.muted} />
            <Text variant="muted" style={styles.optionLabel}>
              Ignorar
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    width: "100%",
    backgroundColor: colors.surface,
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
  optionLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: colors.text,
  },
});
