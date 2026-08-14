import { View, Pressable, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "@/components/ui";
import { hapticSelection } from "@/lib/haptics";
import { colors, spacing, fontSize } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * TASK-115 (episódio) — porta de `EpisodeStarRatingRow.tsx`: 5
 * estrelas INTEIRAS com rótulo embaixo de cada uma. Diferente do
 * `StarRating` de série/filme (sem rótulo) — mantidos como
 * componentes separados, igual ao web faz.
 */
export function EpisodeStarRatingRow({ value, onChange }: { value: number; onChange: (rating: number) => void }) {
  const { t } = useTranslation();
  const LEVELS = [
    { value: 1, label: t("episode.ratingBad") },
    { value: 2, label: t("episode.ratingOk") },
    { value: 3, label: t("episode.ratingGood") },
    { value: 4, label: t("episode.ratingGreat") },
    { value: 5, label: t("episode.ratingWow") },
  ];
  return (
    <View style={styles.row}>
      {LEVELS.map((level) => {
        const filled = value >= level.value;
        return (
          <Pressable
            key={level.value}
            style={styles.button}
            onPress={() => {
              hapticSelection();
              onChange(level.value);
            }}
          >
            <MaterialCommunityIcons name={filled ? "star" : "star-outline"} size={24} color={filled ? colors.primary : colors.muted} />
            <Text style={[styles.label, filled && styles.labelActive]}>{level.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  button: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: spacing.sm,
  },
  label: {
    fontSize: fontSize.micro,
    fontWeight: "700",
    letterSpacing: 0.3,
    color: colors.muted,
  },
  labelActive: {
    color: colors.primary,
  },
});
