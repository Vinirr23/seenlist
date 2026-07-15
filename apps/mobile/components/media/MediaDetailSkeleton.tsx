import { View, StyleSheet } from "react-native";
import { Skeleton } from "@/components/ui";
import { radius, spacing } from "@/lib/theme";

/**
 * TASK-150 (expansão pro resto do app) — "phantom" de tela de
 * detalhe (série, filme, episódio): pôster grande, título, metadados,
 * fileira de botões, parágrafo de sinopse.
 */
export function MediaDetailSkeleton() {
  return (
    <View style={styles.wrapper}>
      <View style={styles.headerRow}>
        <Skeleton width={110} height={165} borderRadius={radius.md} />
        <View style={styles.headerInfo}>
          <Skeleton width="90%" height={20} />
          <Skeleton width="50%" height={13} style={styles.line} />
          <Skeleton width="70%" height={13} style={styles.line} />
        </View>
      </View>

      <View style={styles.buttonRow}>
        <Skeleton width="48%" height={44} borderRadius={radius.md} />
        <Skeleton width="48%" height={44} borderRadius={radius.md} />
      </View>

      <View style={styles.paragraph}>
        <Skeleton width="100%" height={13} />
        <Skeleton width="100%" height={13} style={styles.line} />
        <Skeleton width="60%" height={13} style={styles.line} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  headerInfo: {
    flex: 1,
    justifyContent: "center",
  },
  line: {
    marginTop: spacing.sm,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  paragraph: {
    gap: spacing.xs,
  },
});
