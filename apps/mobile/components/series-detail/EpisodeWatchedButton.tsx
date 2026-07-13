import { Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors } from "@/lib/theme";

const SIZES = {
  sm: { button: 28, icon: 14 },
  md: { button: 32, icon: 16 },
  lg: { button: 40, icon: 20 },
} as const;

/**
 * TASK-099 (correção — pedido do usuário) — porta fiel de
 * `EpisodeWatchedButton.tsx` do web: botão REDONDO (não quadrado
 * como eu tinha feito antes), branco com check preto quando não
 * assistido, colorido (dourado/`colors.primary`) com check branco
 * quando assistido. Um componente único, usado tanto no carrossel
 * do topo quanto em cada linha da lista de temporada — igual ao web,
 * que também reaproveita o mesmo componente nos dois lugares.
 */
export function EpisodeWatchedButton({
  watched,
  onPress,
  disabled,
  size = "md",
}: {
  watched: boolean;
  onPress: () => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const dimensions = SIZES[size];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: watched }}
      style={[
        styles.button,
        {
          width: dimensions.button,
          height: dimensions.button,
          borderRadius: dimensions.button / 2,
          backgroundColor: watched ? colors.primary : "#FFFFFF",
        },
        disabled && styles.disabled,
      ]}
    >
      <Feather name="check" size={dimensions.icon} color={watched ? "#FFFFFF" : "#000000"} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  disabled: {
    opacity: 0.5,
  },
});
