import { View, Pressable, StyleSheet } from "react-native";
import type { LibraryStatus } from "@seenlist/types";
import { Text } from "@/components/ui";
import { colors, radius, spacing } from "@/lib/theme";

const OPTIONS: { status: LibraryStatus; label: string }[] = [
  { status: "watching", label: "Assistindo" },
  { status: "want_to_watch", label: "Assistir depois" },
  { status: "paused", label: "Pausada" },
];

export function StatusPicker({
  currentStatus,
  busy,
  onChange,
}: {
  currentStatus: LibraryStatus | null;
  busy: boolean;
  onChange: (status: LibraryStatus) => void;
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
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  buttonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  label: {
    color: colors.muted,
    fontSize: 12,
  },
  labelActive: {
    color: colors.background,
    fontSize: 12,
  },
});
