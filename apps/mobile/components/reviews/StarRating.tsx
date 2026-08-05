import { View, Pressable, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors } from "@/lib/theme";

/**
 * TASK-101 (Avaliações) — porta de `StarRating.tsx` do web: um
 * componente só, vira input quando `onChange` é passado (usado no
 * `ReviewComposer`) ou só exibição sem ele (usado no `ReviewCard`) —
 * evita duplicar a mesma renderização de 5 estrelas duas vezes.
 *
 * CORREÇÃO (bug real, reportado — "estrelas não são preenchidas com
 * cor, diferente do web") — `Feather` é uma família de ícone SÓ de
 * contorno: não tem versão preenchida, então a estrela marcada só
 * mudava a COR da linha, nunca preenchia por dentro. O web usa
 * `lucide-react` com `fill="currentColor"`. `MaterialCommunityIcons`
 * já vem no mesmo pacote `@expo/vector-icons` que o app já usa
 * (nenhuma dependência nova) e tem os dois: "star" (preenchida) e
 * "star-outline" (contorno).
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
        const icon = (
          <MaterialCommunityIcons
            name={filled ? "star" : "star-outline"}
            size={starSize + 2}
            color={filled ? colors.primary : colors.border}
          />
        );

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
