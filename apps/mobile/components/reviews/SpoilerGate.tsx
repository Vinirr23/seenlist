import { useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Text } from "@/components/ui";
import { colors, radius, spacing } from "@/lib/theme";

export function SpoilerGate({ hidden, children }: { hidden: boolean; children: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false);
  if (!hidden || revealed) return <>{children}</>;

  return (
    <Pressable style={styles.gate} onPress={() => setRevealed(true)}>
      <Feather name="eye-off" size={13} color={colors.muted} />
      <Text variant="muted" style={styles.text}>
        Contém spoiler — toque para revelar
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  gate: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  text: {
    fontSize: 12,
  },
});
