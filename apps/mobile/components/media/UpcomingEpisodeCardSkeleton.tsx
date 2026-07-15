import { View, StyleSheet } from "react-native";
import { Skeleton } from "@/components/ui";
import { colors, radius, spacing } from "@/lib/theme";

/**
 * TASK-150 (a pedido) — "phantom" no formato do `UpcomingEpisodeCard.tsx`
 * de verdade (aba "Em breve").
 */
export function UpcomingEpisodeCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.wrapper}>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={styles.row}>
          <Skeleton width={64} height={96} borderRadius={radius.sm} />
          <View style={styles.info}>
            <Skeleton width="55%" height={12} borderRadius={radius.full} />
            <Skeleton width="45%" height={16} style={styles.line} />
            <Skeleton width="70%" height={11} style={styles.line} />
            <Skeleton width={70} height={16} style={styles.line} />
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
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  info: {
    flex: 1,
    justifyContent: "center",
  },
  line: {
    marginTop: 6,
  },
});
