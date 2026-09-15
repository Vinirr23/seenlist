import { View, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ReviewAggregate } from "@/lib/social/reviews";
import { Text, Glass } from "@/components/ui";
import { colors, radius, spacing } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * A PEDIDO (implementar tudo igual ao web) — porta de
 * `ReviewSummary.tsx` do web: nota média grande + barra de
 * distribuição por estrela (5→1), tipo Letterboxd. Some sozinho
 * quando ninguém avaliou ainda.
 *
 * PORTE DO WEB (2026-09-04, "vidro que falta") — vira `<Glass>` (web:
 * "mesma textura de card neutro já usada em MetaRow.tsx").
 */
export function ReviewSummary({ aggregate }: { aggregate: ReviewAggregate }) {
  const { t } = useTranslation();
  if (aggregate.count === 0 || aggregate.average == null) return null;

  const maxCount = Math.max(1, ...aggregate.distribution.map((d) => d.count));

  return (
    <Glass style={styles.card}>
      <View style={styles.left}>
        <Text style={styles.average}>{aggregate.average.toFixed(1)}</Text>
        <Text variant="muted" style={styles.count}>
          {aggregate.count} {aggregate.count === 1 ? t("episode.ratingSingular") : t("episode.ratingPlural")}
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
    </Glass>
  );
}

const styles = StyleSheet.create({
  // `Glass` não define raio nenhum — quem usa é que diz. Web usa
  // `rounded-2xl` (16px) nos cartões de Comentários/Avaliações, que é o
  // `radius.lg` daqui (era `radius.md`=10 antes do porte).
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.lg,
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
