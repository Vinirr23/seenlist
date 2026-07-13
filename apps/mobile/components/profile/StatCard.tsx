import { View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Text } from "@/components/ui";
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
    <View style={styles.card}>
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
    </View>
  );
}

const CARD_WIDTH = 152;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  value: {
    marginTop: spacing.sm,
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.text,
  },
  subtext: {
    fontSize: 11,
  },
  title: {
    marginTop: spacing.xs,
    fontSize: 11,
  },
});
