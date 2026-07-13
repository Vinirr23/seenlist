import { View, Modal, Pressable, StyleSheet } from "react-native";
import { Text } from "@/components/ui";
import { colors, radius, spacing } from "@/lib/theme";

export interface OptionSheetAction {
  label: string;
  active?: boolean;
  danger?: boolean;
  onPress: () => void;
}

export function OptionSheet({
  title,
  message,
  actions,
  onDismiss,
}: {
  title: string;
  message?: string;
  actions: OptionSheetAction[];
  onDismiss: () => void;
}) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text variant="subtitle" style={styles.title}>
            {title}
          </Text>
          {!!message && (
            <Text variant="muted" style={styles.message}>
              {message}
            </Text>
          )}

          <View style={styles.actions}>
            {actions.map((action) => (
              <Pressable
                key={action.label}
                style={[styles.actionButton, action.active && styles.actionButtonActive]}
                onPress={action.onPress}
              >
                <Text style={action.danger ? styles.actionTextDanger : action.active ? styles.actionTextActive : styles.actionText}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: spacing.xl,
  },
  card: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  title: {
    textAlign: "center",
  },
  message: {
    marginTop: spacing.xs,
    textAlign: "center",
  },
  actions: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  actionButton: {
    alignItems: "center",
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
  },
  actionButtonActive: {
    backgroundColor: "rgba(232,163,61,0.12)",
  },
  actionText: {
    fontSize: 14,
    color: colors.text,
  },
  actionTextActive: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
  },
  actionTextDanger: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.danger,
  },
});
