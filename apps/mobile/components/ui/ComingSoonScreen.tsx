import { Feather } from "@expo/vector-icons";
import { Screen, Text } from "@/components/ui";
import { colors, spacing } from "@/lib/theme";
import { View, StyleSheet } from "react-native";

/**
 * TASK-090 — cada aba usa isso até ganhar sua tela de verdade,
 * tela por tela, nas próximas sessões (ver "Pendências conhecidas"
 * em SEENLIST-SESSAO-2026-07-12.md).
 */
export function ComingSoonScreen({
  icon,
  title,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
}) {
  return (
    <Screen>
      <View style={styles.wrapper}>
        <View style={styles.iconCircle}>
          <Feather name={icon} size={28} color={colors.primary} />
        </View>
        <Text variant="subtitle" style={styles.title}>
          {title}
        </Text>
        <Text variant="muted" style={styles.text}>
          Essa tela ainda está sendo construída nativamente. Em breve.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  title: {
    textAlign: "center",
  },
  text: {
    textAlign: "center",
    maxWidth: 260,
  },
});
