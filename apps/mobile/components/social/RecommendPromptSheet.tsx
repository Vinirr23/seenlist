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
 * CORREÇÃO (2026-10-06, "o popup não tem espaço suficiente") — era um
 * bottom-sheet (`overlay` com `justifyContent: "flex-end"`), sem
 * `maxHeight` nem padding de área segura: em telas menores ou com
 * textos maiores, o conteúdo ficava cortado pela barra do sistema
 * (ver print do usuário). Virou um dialog CENTRALIZADO (mesmo
 * espírito do popup nativo de avaliar o app, que o SO desenha e
 * centraliza sozinho) — mockup aprovado, opção C:
 * https://claude.ai/artifact/D4beUHvSffHhhYiFRkUtEc
 *
 * "Agora não" mantém o mesmo peso visual de antes (texto, não botão
 * escondido) — não é um dark pattern pra forçar o "sim". Tocar fora
 * também fecha.
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
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />

        <Glass style={styles.dialog} variant="dark">
          <View style={styles.poster}>
            {posterUrl && <Image source={{ uri: posterUrl }} style={styles.posterImage} contentFit="cover" />}
          </View>

          <View style={styles.starsRow}>
            {Array.from({ length: 5 }).map((_, i) => (
              <MaterialCommunityIcons
                key={i}
                name={i < rating ? "star" : "star-outline"}
                size={15}
                color={colors.primary}
              />
            ))}
          </View>

          <Text style={styles.title}>{t("social.recommendPromptTitle", { mediaTitle })}</Text>
          <Text variant="muted" style={styles.subtitle}>
            {t("social.recommendPromptSubtitle")}
          </Text>

          <View style={styles.actions}>
            <Button onPress={onRecommend}>{t("social.recommendPromptCta")}</Button>
            <Pressable style={styles.dismissButton} onPress={onDismiss} hitSlop={8}>
              <Text variant="muted" style={styles.dismissText}>
                {t("social.recommendPromptDismiss")}
              </Text>
            </Pressable>
          </View>
        </Glass>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    backgroundColor: scrim.modal,
  },
  dialog: {
    ...elevation.high,
    width: "100%",
    maxWidth: 320,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    alignItems: "center",
  },
  poster: {
    width: 72,
    height: 108,
    borderRadius: radius.sm,
    overflow: "hidden",
    backgroundColor: colors.background,
    marginBottom: spacing.sm,
  },
  posterImage: {
    width: "100%",
    height: "100%",
  },
  starsRow: {
    flexDirection: "row",
    gap: 2,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.xs,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  actions: {
    width: "100%",
    alignItems: "stretch",
    gap: spacing.sm,
  },
  dismissButton: {
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  dismissText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
});
