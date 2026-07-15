import { View, StyleSheet } from "react-native";
import { Skeleton } from "@/components/ui";
import { colors, radius, spacing } from "@/lib/theme";

/**
 * TASK-150 (expansão pro resto do app) — "phantom" de linha com
 * avatar redondo (usuário/notificação/comentário), diferente do
 * `LibraryListSkeleton` que tem pôster retangular.
 */
export function AvatarRowSkeleton({ count = 5, boxed = false }: { count?: number; boxed?: boolean }) {
  return (
    <View style={styles.wrapper}>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={[styles.row, boxed && styles.rowBoxed]}>
          <Skeleton width={44} height={44} borderRadius={22} />
          <View style={styles.info}>
            <Skeleton width="55%" height={13} />
            <Skeleton width="35%" height={11} style={styles.secondLine} />
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
    paddingVertical: spacing.xs,
  },
  rowBoxed: {
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
