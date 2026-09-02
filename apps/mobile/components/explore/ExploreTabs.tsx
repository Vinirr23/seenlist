import { ScrollView, Pressable, StyleSheet } from "react-native";
import { Text, Glass, GelSurface } from "@/components/ui";
import { colors, radius, spacing, fontSize } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

// PORTE DO WEB (2026-09-02, reformulação completa da Explorar) —
// versão RN de `apps/web/components/explore/ExploreTabs.tsx`: a
// antiga aba única "Descobrir" (misturava séries e filmes) virou 3
// abas dedicadas, mesma mudança já feita no web em 2026-08-21.
export type ExploreTab = "movies" | "series" | "activity";

const TABS: { key: ExploreTab; labelKey: string }[] = [
  { key: "movies", labelKey: "explore.tab.movies" },
  { key: "series", labelKey: "explore.tab.series" },
  { key: "activity", labelKey: "explore.tab.activity" },
];

/**
 * Cada aba é uma pílula PRÓPRIA (não uma cápsula deslizante
 * compartilhada como `SlidingTabs.tsx`) — igual ao web: a ativa usa
 * `GelSurface` (mesmo "gel" âmbar sólido do botão "Ver detalhes"), a
 * inativa usa `Glass` (mesmo vidro neutro de qualquer card da tela).
 * Isso é INTENCIONAL — reflete exatamente a estrutura visual do web
 * (`isActive ? <pílula gel âmbar> : <pílula vidro neutro>`), não uma
 * adaptação aproximada.
 */
export function ExploreTabs({ active, onChange }: { active: ExploreTab; onChange: (tab: ExploreTab) => void }) {
  const { t } = useTranslation();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        const Surface = isActive ? GelSurface : Glass;
        return (
          <Pressable key={tab.key} onPress={() => onChange(tab.key)}>
            <Surface style={styles.pill}>
              <Text style={isActive ? styles.labelActive : styles.label}>{t(tab.labelKey)}</Text>
            </Surface>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  pill: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  label: {
    fontSize: fontSize.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: colors.muted,
  },
  labelActive: {
    fontSize: fontSize.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: colors.background,
  },
});
