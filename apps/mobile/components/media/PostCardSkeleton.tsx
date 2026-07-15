import { View, StyleSheet } from "react-native";
import { Skeleton } from "@/components/ui";
import { colors, radius, spacing } from "@/lib/theme";

/**
 * TASK-150 (expansão pro resto do app) — "phantom" de card de post
 * (Feed, tela de post, atividade do Explorar): avatar + nome + corpo
 * de texto + imagem.
 */
export function PostCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.wrapper}>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={styles.card}>
          <View style={styles.headerRow}>
            <Skeleton width={36} height={36} borderRadius={18} />
            <View style={styles.headerInfo}>
              <Skeleton width="40%" height={12} />
              <Skeleton width="25%" height={10} style={styles.secondLine} />
            </View>
          </View>
          <Skeleton width="100%" height={12} style={styles.bodyLine} />
          <Skeleton width="70%" height={12} style={styles.bodyLine} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.sm,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  headerInfo: {
    flex: 1,
    gap: 6,
  },
  secondLine: {
    marginTop: 2,
  },
  bodyLine: {
    marginTop: spacing.sm,
  },
});
