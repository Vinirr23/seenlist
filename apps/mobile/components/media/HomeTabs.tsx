import { View, Pressable, StyleSheet } from "react-native";
import { Text } from "@/components/ui";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { colors, radius, spacing } from "@/lib/theme";

export type HomeTab = "minha-lista" | "em-breve";

export function HomeTabs({ active, onChange }: { active: HomeTab; onChange: (tab: HomeTab) => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.tabs}>
      <TabButton label={t("seriesHome.tab.myList")} active={active === "minha-lista"} onPress={() => onChange("minha-lista")} />
      <TabButton label={t("seriesHome.tab.upcoming")} active={active === "em-breve"} onPress={() => onChange("em-breve")} />
    </View>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tabButton, active && styles.tabButtonActive]}>
      <Text variant="label" style={active ? styles.tabLabelActive : styles.tabLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  tabButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
  },
  tabLabel: {
    color: colors.muted,
  },
  tabLabelActive: {
    color: colors.background,
  },
});
