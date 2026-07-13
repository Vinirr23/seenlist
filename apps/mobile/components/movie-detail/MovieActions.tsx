import { View, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { MovieWatchStatus } from "@seenlist/types";
import { Text } from "@/components/ui";
import { colors, radius, spacing } from "@/lib/theme";

const OPTIONS: { status: MovieWatchStatus; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { status: "watched", label: "Assistido", icon: "check" },
  { status: "want_to_watch", label: "Assistir depois", icon: "plus" },
];

export function MovieActions({
  currentStatus,
  busy,
  onChange,
}: {
  currentStatus: MovieWatchStatus | null;
  busy: boolean;
  onChange: (status: MovieWatchStatus) => void;
}) {
  return (
    <View style={styles.row}>
      {OPTIONS.map((option) => {
        const active = currentStatus === option.status;
        return (
          <Pressable
            key={option.status}
            disabled={busy}
            onPress={() => onChange(option.status)}
            style={[styles.button, active && styles.buttonActive]}
          >
            <Feather name={option.icon} size={16} color={active ? colors.primary : colors.muted} />
            <Text variant="label" style={active ? styles.labelActive : styles.label}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  button: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonActive: {
    borderColor: colors.primary,
    backgroundColor: "rgba(232,163,61,0.12)",
  },
  label: {
    color: colors.muted,
    fontSize: 11,
  },
  labelActive: {
    color: colors.primary,
    fontSize: 11,
  },
});
