import { View, Pressable, StyleSheet } from "react-native";
import { Text } from "@/components/ui";
import { colors, radius, spacing } from "@/lib/theme";

const MOODS = [
  { key: "shocked", emoji: "😵", label: "Chocado" },
  { key: "frustrated", emoji: "😤", label: "Frustrado" },
  { key: "sad", emoji: "😭", label: "Triste" },
  { key: "thoughtful", emoji: "🤔", label: "Reflexivo" },
  { key: "touched", emoji: "🥺", label: "Comovido" },
  { key: "entertained", emoji: "😆", label: "Entretido" },
  { key: "scared", emoji: "😱", label: "Assustado" },
  { key: "bored", emoji: "😑", label: "Entediado" },
  { key: "content", emoji: "😌", label: "Compreensivo" },
  { key: "hyped", emoji: "🤩", label: "Empolgado" },
  { key: "confused", emoji: "🙃", label: "Confuso" },
  { key: "tense", emoji: "😬", label: "Tenso" },
];

/** TASK-173 (antes: escolha única) — múltipla escolha: cada toque alterna esse humor na lista, sem desmarcar os outros. */
export function EpisodeMoodPicker({ value, onChange }: { value: string[]; onChange: (moods: string[]) => void }) {
  return (
    <View style={styles.grid}>
      {MOODS.map((mood) => {
        const selected = value.includes(mood.key);
        return (
          <Pressable
            key={mood.key}
            style={[styles.card, selected && styles.cardActive]}
            onPress={() => onChange(selected ? value.filter((m) => m !== mood.key) : [...value, mood.key])}
          >
            <Text style={styles.emoji}>{mood.emoji}</Text>
            <Text style={[styles.label, selected && styles.labelActive]} numberOfLines={1}>
              {mood.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const CARD_WIDTH = "23%";

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  card: {
    width: CARD_WIDTH,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.xs,
  },
  cardActive: {
    borderColor: colors.primary,
    backgroundColor: "rgba(232,163,61,0.1)",
  },
  emoji: {
    fontSize: 22,
  },
  label: {
    fontSize: 10,
    fontWeight: "500",
    color: colors.muted,
    textAlign: "center",
  },
  labelActive: {
    color: colors.primary,
  },
});
