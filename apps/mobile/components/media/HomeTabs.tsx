import { View, StyleSheet } from "react-native";
import { SlidingTabs } from "@/components/ui";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { spacing } from "@/lib/theme";

export type HomeTab = "minha-lista" | "em-breve";

/**
 * Fina camada sobre `SlidingTabs` (genérico, `components/ui/`) — só
 * resolve os rótulos traduzidos, fixa as duas opções certas, e
 * mantém o espaçamento próprio que as duas telas que usam isto
 * (`series/index.tsx`, `movies.tsx`) esperam de fora — os dois
 * lugares só dão `paddingTop`, contam com este componente pro
 * padding horizontal e margem de baixo (por isso não dava pra tirar
 * esse `wrapper` na hora de generalizar: sem ele, a trilha ficaria
 * colada na borda da tela).
 *
 * A lógica de cápsula deslizante em si mora só em `SlidingTabs`, pra
 * não duplicar (mesmo padrão reaproveitado em `explore.tsx`, que
 * tinha uma cópia local desatualizada até ser achada e migrada).
 */
export function HomeTabs({ active, onChange }: { active: HomeTab; onChange: (tab: HomeTab) => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.wrapper}>
      <SlidingTabs
        active={active}
        onChange={onChange}
        options={[
          { value: "minha-lista", label: t("seriesHome.tab.myList") },
          { value: "em-breve", label: t("seriesHome.tab.upcoming") },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
});
