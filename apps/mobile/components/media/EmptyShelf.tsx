import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Text, Button } from "@/components/ui";
import { spacing } from "@/lib/theme";

export function EmptyShelf({
  message,
  actionLabel,
  actionHref,
}: {
  message: string;
  actionLabel?: string;
  actionHref?: "/(tabs)/explore";
}) {
  const router = useRouter();

  return (
    <View style={styles.wrapper}>
      <Text variant="muted" style={styles.message}>
        {message}
      </Text>
      {!!actionLabel && !!actionHref && (
        <Button variant="secondary" onPress={() => router.push(actionHref)}>
          {actionLabel}
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  message: {
    textAlign: "center",
  },
});
