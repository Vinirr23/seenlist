import { StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Text, Glass } from "@/components/ui";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

export function StatCard({
  icon,
  title,
  value,
  subtext,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  value: string;
  subtext?: string;
}) {
  return (
    <Glass style={styles.card}>
      <Feather name={icon} size={18} color={colors.primary} />
      <Text style={styles.value}>{value}</Text>
      {!!subtext && (
        <Text variant="muted" style={styles.subtext}>
          {subtext}
        </Text>
      )}
      <Text variant="muted" style={styles.title}>
        {title}
      </Text>
    </Glass>
  );
}

const CARD_WIDTH = 152;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  value: {
    marginTop: spacing.sm,
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.text,
  },
  // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.xxs` (era literal 11, mesmo valor).
  subtext: {
    fontSize: fontSize.xxs,
  },
  // FASE 2 (consistência visual sistêmica, 2026-09-26) — era `fontSize:
  // 11` literal; `StatisticsCard.tsx` já usa `fontSize.xs` (12) pro
  // mesmo papel (rótulo embaixo/ao lado do número) — mesma hierarquia
  // semântica, alinhado ao token.
  title: {
    marginTop: spacing.xs,
    fontSize: fontSize.xs,
  },
});
