import { View, StyleSheet } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, radius } from "@/lib/theme";

/**
 * NOVO (2026-10-07) — "Novidades". Chip de ícone por `icon_key` (coluna
 * de `whats_new_entries`) — mesmas cores/formato do selo de
 * `SeasonRecapCard.tsx` (fundo translúcido + borda na cor do ícone),
 * só generalizado pra mais de uma categoria. Uma `icon_key` que o app
 * ainda não conhece (ex.: categoria futura lançada sem update do app)
 * cai no ícone padrão (sparkle) em vez de quebrar — mesmo raciocínio
 * de "nunca travar por um valor desconhecido" já aplicado em
 * `getNotificationMessage`.
 */

const ICON_CONFIG: Record<string, { tint: string; background: string; border: string; render: (size: number, color: string) => React.ReactNode }> = {
  "list-share": {
    tint: colors.secondary,
    background: "rgba(79,209,197,0.12)",
    border: "rgba(79,209,197,0.3)",
    render: (size, color) => <Feather name="users" size={size} color={color} />,
  },
  "season-recap": {
    tint: colors.primary,
    background: "rgba(232,163,61,0.12)",
    border: "rgba(232,163,61,0.3)",
    render: (size, color) => <MaterialCommunityIcons name="creation" size={size} color={color} />,
  },
};

const DEFAULT_CONFIG = {
  tint: colors.primary,
  background: "rgba(232,163,61,0.12)",
  border: "rgba(232,163,61,0.3)",
  render: (size: number, color: string) => <MaterialCommunityIcons name="creation" size={size} color={color} />,
};

export function WhatsNewIcon({ iconKey, size = 18, chipSize = 36 }: { iconKey: string; size?: number; chipSize?: number }) {
  const config = ICON_CONFIG[iconKey] ?? DEFAULT_CONFIG;
  return (
    <View
      style={[
        styles.chip,
        { width: chipSize, height: chipSize, backgroundColor: config.background, borderColor: config.border },
      ]}
    >
      {config.render(size, config.tint)}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
