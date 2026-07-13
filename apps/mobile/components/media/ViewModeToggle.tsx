import { View, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { ViewMode } from "@/lib/useViewModePreference";
import { colors, radius } from "@/lib/theme";

export function ViewModeToggle({ viewMode, onChange }: { viewMode: ViewMode; onChange: (mode: ViewMode) => void }) {
  return (
    <View style={styles.wrapper}>
      <Pressable style={[styles.button, viewMode === "grid" && styles.buttonActive]} onPress={() => onChange("grid")}>
        <Feather name="grid" size={16} color={viewMode === "grid" ? colors.primary : colors.muted} />
      </Pressable>
      <Pressable style={[styles.button, viewMode === "list" && styles.buttonActive]} onPress={() => onChange("list")}>
        <Feather name="list" size={16} color={viewMode === "list" ? colors.primary : colors.muted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    gap: 2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 2,
  },
  button: {
    padding: 6,
    borderRadius: radius.sm,
  },
  buttonActive: {
    backgroundColor: colors.surface,
  },
});
