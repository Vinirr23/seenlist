import { View, StyleSheet } from "react-native";
import { Text } from "@/components/ui";
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
    <View style={styles.card}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  title: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  value: {
    fontSize: fontSize.xxl,
    fontWeight: "700",
    color: colors.text,
  },
  subtext: {
    fontSize: 11,
    marginTop: 2,
  },
  children: {
    marginTop: spacing.sm,
  },
});
