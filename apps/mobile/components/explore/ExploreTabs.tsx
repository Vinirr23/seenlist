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
 *
 * BUG REAL CORRIGIDO (a pedido, print comparando lado a lado com o
 * web, 2026-09-16) — as duas superfícies eram trocadas SEM as props
 * que o resto do app já usa pra essas mesmas duas receitas:
 *
 *   1. `<Glass style={styles.pill}>` (aba inativa) não passava
 *      `variant` nenhum — caía no padrão do componente, `variant=
 *      "card"` (base azulada `rgba(80,115,180,0.10)`, blur 18px/sat
 *      180%). O web usa aqui a receita "leve"
 *      (`backdrop-blur-[10px] backdrop-saturate-[160%]`, base quase
 *      neutra `rgba(255,255,255,0.06)`) — a MESMA receita que
 *      `SectionTitle.tsx`/`GenreChips.tsx`/`SlidingTabs.tsx` já usam
 *      via `variant="light"`. Sem ela, a pílula inativa saía mais
 *      forte/azulada e com borda mais visível que no web — exatamente
 *      o que apareceu no print comparativo.
 *   2. `<GelSurface style={styles.pill}>` (aba ativa) não passava
 *      `webCalibrated` — todo outro botão "gel" do app (`StatisticsCard`,
 *      `EmptyLibraryHero`, `EmptyShelf`, `lists/index.tsx`, botão de
 *      comentários dos episódios) já usa essa calibração (degradê
 *      VERTICAL puro, sem a lavagem branca por cima, medida pixel a
 *      pixel contra o web — ver comentário completo em `GelSurface()`
 *      em `Glass.tsx`). Só esta tela e o botão "Editar" do perfil
 *      público (`u/[username]/index.tsx`, corrigido junto) tinham
 *      ficado pra trás dessa padronização.
 *
 * Virou um `if`/`else` explícito (em vez de `Surface = isActive ?
 * GelSurface : Glass`) porque as duas props (`variant`/`webCalibrated`)
 * só existem numa das duas superfícies — não dá pra passar as duas
 * genericamente num componente escolhido em runtime sem checagem de
 * tipo reclamar.
 */
export function ExploreTabs({ active, onChange }: { active: ExploreTab; onChange: (tab: ExploreTab) => void }) {
  const { t } = useTranslation();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        return (
          <Pressable key={tab.key} onPress={() => onChange(tab.key)}>
            {isActive ? (
              <GelSurface style={styles.pill} webCalibrated>
                <Text style={styles.labelActive}>{t(tab.labelKey)}</Text>
              </GelSurface>
            ) : (
              <Glass style={styles.pill} variant="light">
                <Text style={styles.label}>{t(tab.labelKey)}</Text>
              </Glass>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // CORREÇÃO (2026-09-03, decisão do usuário: padronizar borda de tela
  // em 16px app-wide) — `paddingHorizontal` era `spacing.lg` (24). Esta
  // fileira é renderizada "crua" (sem container com padding) no
  // Explorar — este `paddingHorizontal` É a borda de tela.
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
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
