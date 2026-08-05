import { View, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ReviewAggregate } from "@/lib/social/reviews";
import { Text } from "@/components/ui";
import { colors, radius, spacing } from "@/lib/theme";

/**
 * A PEDIDO (implementar tudo igual ao web) — porta de
 * `ReviewSummary.tsx` do web: nota média grande + barra de
 * distribuição por estrela (5→1), tipo Letterboxd. Some sozinho
 * quando ninguém avaliou ainda.
 */
export function ReviewSummary({ aggregate }: { aggregate: ReviewAggregate }) {
  if (aggregate.count === 0 || aggregate.average == null) return null;

  const maxCount = Math.max(1, ...aggregate.distribution.map((d) => d.count));

  return (
    <View style={styles.card}>
      <View style={styles.left}>
        <Text style={styles.average}>{aggregate.average.toFixed(1)}</Text>
        <Text variant="muted" style={styles.count}>
          {aggregate.count === 1 ? "1 avaliação" : `${aggregate.count} avaliações`}
        </Text>
      </View>
      <View style={styles.right}>
        {aggregate.distribution.map(({ star, count }) => (
          <View key={star} style={styles.row}>
            <View style={styles.starLabel}>
              <Text variant="muted" style={styles.starLabelText}>
                {star}
              </Text>
              <MaterialCommunityIcons name="star" size={11} color={colors.muted} />
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${(count / maxCount) * 100}%` }]} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  left: {
    alignItems: "center",
  },
  average: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.primary,
  },
  count: {
    marginTop: 2,
    fontSize: 10,
  },
  right: {
    flex: 1,
    gap: spacing.xs / 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  starLabel: {
    width: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  starLabelText: {
    fontSize: 10,
  },
  track: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    overflow: "hidden",
    backgroundColor: colors.background,
  },
  fill: {
    height: "100%",
    backgroundColor: colors.primary,
  },
});
