import { View, StyleSheet } from "react-native";
import { Skeleton } from "@/components/ui";
import { colors, radius, spacing } from "@/lib/theme";

/**
 * TASK-150 (a pedido) — "phantom" no formato de linha (modo lista),
 * mesmas dimensões do `MediaListRow.tsx`/`ContinueWatchingListRow.tsx`
 * de verdade.
 */
export function LibraryListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.wrapper}>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={styles.row}>
          <Skeleton width={56} height={80} borderRadius={radius.sm} />
          <View style={styles.info}>
            <Skeleton width="70%" height={14} />
            <Skeleton width="40%" height={11} style={styles.secondLine} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  info: {
    flex: 1,
    gap: 6,
  },
  secondLine: {
    marginTop: 2,
  },
});
