import { View, StyleSheet } from "react-native";
import { Text, Glass } from "@/components/ui";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

export function BigStatCard({
  title,
  value,
  subtext,
  children,
}: {
  title: string;
  value: string;
  subtext?: string;
  children?: React.ReactNode;
}) {
  return (
    <Glass style={styles.card}>
      <Text variant="muted" style={styles.title}>
        {title.toUpperCase()}
      </Text>
      <Text style={styles.value}>{value}</Text>
      {!!subtext && (
        <Text variant="muted" style={styles.subtext}>
          {subtext}
        </Text>
      )}
      {!!children && <View style={styles.children}>{children}</View>}
    </Glass>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  // FASE 2 (consistência visual sistêmica, 2026-09-26) — era `fontSize:
  // 11` literal; `StatisticsCard.tsx` já usa `fontSize.xs` (12) pro
  // mesmo papel (rótulo embaixo/ao lado do número) — mesma hierarquia
  // semântica, alinhado ao token.
  title: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  value: {
    fontSize: fontSize.xxl,
    fontWeight: "700",
    color: colors.text,
  },
  // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.xxs` (era literal 11, mesmo valor).
  subtext: {
    fontSize: fontSize.xxs,
    marginTop: 2,
  },
  children: {
    marginTop: spacing.sm,
  },
});
