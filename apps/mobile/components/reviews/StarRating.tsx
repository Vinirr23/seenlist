import { View, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors } from "@/lib/theme";

/**
 * TASK-101 (Avaliações) — porta de `StarRating.tsx` do web: um
 * componente só, vira input quando `onChange` é passado (usado no
 * `ReviewComposer`) ou só exibição sem ele (usado no `ReviewCard`) —
 * evita duplicar a mesma renderização de 5 estrelas duas vezes.
 */
export function StarRating({
  value,
  onChange,
  size = "md",
}: {
  value: number;
  onChange?: (value: number) => void;
  size?: "sm" | "md";
}) {
  const isInput = Boolean(onChange);
  const starSize = size === "sm" ? 14 : 24;

  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= value;
        const icon = <Feather name="star" size={starSize} color={filled ? colors.primary : colors.border} />;

        if (!isInput) return <View key={star}>{icon}</View>;

        return (
          <Pressable key={star} onPress={() => onChange?.(star)} hitSlop={4} style={styles.starButton}>
            {icon}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  starButton: {
    padding: 2,
  },
});
