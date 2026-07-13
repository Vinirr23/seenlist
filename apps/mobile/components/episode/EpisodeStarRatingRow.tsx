import { View, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Text } from "@/components/ui";
import { colors, spacing } from "@/lib/theme";

const LEVELS = [
  { value: 1, label: "RUIM" },
  { value: 2, label: "OK" },
  { value: 3, label: "BOM" },
  { value: 4, label: "ÓTIMO" },
  { value: 5, label: "UAU" },
];

/**
 * TASK-115 (episódio) — porta de `EpisodeStarRatingRow.tsx`: 5
 * estrelas INTEIRAS com rótulo embaixo de cada uma. Diferente do
 * `StarRating` de série/filme (sem rótulo) — mantidos como
 * componentes separados, igual ao web faz.
 */
export function EpisodeStarRatingRow({ value, onChange }: { value: number; onChange: (rating: number) => void }) {
  return (
    <View style={styles.row}>
      {LEVELS.map((level) => {
        const filled = value >= level.value;
        return (
          <Pressable key={level.value} style={styles.button} onPress={() => onChange(level.value)}>
            <Feather name="star" size={22} color={filled ? colors.primary : colors.muted} />
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
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.3,
    color: colors.muted,
  },
  labelActive: {
    color: colors.primary,
  },
});
