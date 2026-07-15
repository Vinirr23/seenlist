import { View, StyleSheet, useWindowDimensions } from "react-native";
import { Skeleton } from "@/components/ui";
import { spacing } from "@/lib/theme";

const COLUMNS = 3;
const GAP = spacing.sm;

/**
 * TASK-150 (a pedido) — "phantom" da grade de pôsteres, mesmo cálculo
 * de largura do `PosterGrid.tsx` de verdade (ver comentário lá sobre
 * por que `Math.floor` + `useWindowDimensions`), pra não pular de
 * tamanho quando o conteúdo de verdade substituir o skeleton.
 */
export function LibraryGridSkeleton({ count = 6 }: { count?: number }) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.floor((width - spacing.lg * 2 - GAP * (COLUMNS - 1)) / COLUMNS);

  return (
    <View style={styles.grid}>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={{ width: cardWidth }}>
          <Skeleton width="100%" height={cardWidth * 1.5} />
          <Skeleton width="80%" height={12} style={styles.titleLine} />
          <Skeleton width="40%" height={10} style={styles.yearLine} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GAP,
  },
  titleLine: {
    marginTop: spacing.xs,
  },
  yearLine: {
    marginTop: 4,
  },
});
