import { View, Modal, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { tmdbImageUrl } from "@/lib/library";
import { Text, Button } from "@/components/ui";
import { colors, radius, spacing, fontSize, scrim, elevation } from "@/lib/theme";

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
  const posterUrl = tmdbImageUrl(posterPath, "w185");

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />

        <View style={styles.sheet}>
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
              <Text style={styles.title} numberOfLines={2}>
                Você gostou de {mediaTitle}!
              </Text>
              <Text variant="muted" style={styles.subtitle}>
                Tem alguém que também ia gostar?
              </Text>
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable style={styles.dismissButton} onPress={onDismiss} hitSlop={8}>
              <Text variant="muted" style={styles.dismissText}>
                Agora não
              </Text>
            </Pressable>
            <View style={styles.recommendButton}>
              <Button onPress={onRecommend}>Recomendar</Button>
            </View>
          </View>
        </View>
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
  sheet: {
    ...elevation.high,
    backgroundColor: colors.surface,
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
