import { View, Modal, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { tmdbImageUrl } from "@/lib/library";
import { Text, Button, Glass } from "@/components/ui";
import { colors, radius, spacing, fontSize, scrim, elevation } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * A PEDIDO — convite pra recomendar, mostrado depois de uma
 * avaliação de 4 ou 5 estrelas. As regras de QUANDO aparecer moram
 * em `lib/recommendPrompt.ts` (fora daqui de propósito) — este
 * componente só desenha.
 *
 * Deliberadamente discreto, conforme pedido: aparece de baixo,
 * ocupa pouca altura, e "Agora não" tem o mesmo peso de toque que
 * "Recomendar" (não é um botão escondidinho de propósito pra forçar
 * o sim). Tocar fora também fecha, como qualquer folha do app.
 */
export function RecommendPromptSheet({
  mediaTitle,
  posterPath,
  rating,
  onRecommend,
  onDismiss,
}: {
  mediaTitle: string;
  posterPath: string | null;
  rating: number;
  onRecommend: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const posterUrl = tmdbImageUrl(posterPath, "w185");

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />

        <Glass style={styles.sheet} variant="dark">
          <View style={styles.row}>
            <View style={styles.poster}>
              {posterUrl && <Image source={{ uri: posterUrl }} style={styles.posterImage} contentFit="cover" />}
            </View>

            <View style={styles.info}>
              <View style={styles.starsRow}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <MaterialCommunityIcons
                    key={i}
                    name={i < rating ? "star" : "star-outline"}
                    size={13}
                    color={colors.primary}
                  />
                ))}
              </View>
              {/* CORREÇÃO (FASE 2, strings hardcoded, 2026-09-26) — as 4 strings desta folha eram texto literal, sem passar por `t()`. */}
              <Text style={styles.title} numberOfLines={2}>
                {t("social.recommendPromptTitle", { mediaTitle })}
              </Text>
              <Text variant="muted" style={styles.subtitle}>
                {t("social.recommendPromptSubtitle")}
              </Text>
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable style={styles.dismissButton} onPress={onDismiss} hitSlop={8}>
              <Text variant="muted" style={styles.dismissText}>
                {t("social.recommendPromptDismiss")}
              </Text>
            </Pressable>
            <View style={styles.recommendButton}>
              <Button onPress={onRecommend}>{t("social.recommendPromptCta")}</Button>
            </View>
          </View>
        </Glass>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: scrim.modal,
  },
  // FASE 2 (consistência visual sistêmica, 2026-09-26) — `backgroundColor`
  // sólido saiu (vira `<Glass variant="dark">`, mesmo padrão dos outros
  // sheets do app); `elevation.high` (sombra) é independente do fundo,
  // continua aqui.
  sheet: {
    ...elevation.high,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
  },
  poster: {
    width: 56,
    height: 84,
    borderRadius: radius.sm,
    overflow: "hidden",
    backgroundColor: colors.background,
  },
  posterImage: {
    width: "100%",
    height: "100%",
  },
  info: {
    flex: 1,
    justifyContent: "center",
    gap: 2,
  },
  starsRow: {
    flexDirection: "row",
    gap: 1,
    marginBottom: 2,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.text,
  },
  subtitle: {
    fontSize: fontSize.xs,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  dismissButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  dismissText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  recommendButton: {
    flex: 1,
  },
});
