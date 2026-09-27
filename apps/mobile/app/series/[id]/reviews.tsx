import { ScrollView, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ReviewsFullView } from "@/components/reviews/ReviewsFullView";
import { Screen, GlassTargetProvider, AmbientGlow, ScreenHeader } from "@/components/ui";
import { SUBPAGE_GLOW_BLOBS } from "@/lib/glowBlobs";
import { spacing } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { useTabBarClearance } from "@/lib/useTabBarClearance";

/**
 * A PEDIDO (implementar tudo igual ao web) — tela própria
 * "Avaliações", igual `CommentsPageView.tsx`/`ReviewTextSection.tsx`
 * do web (`/series/[id]/comments`, que hoje só mostra review em
 * texto). Título/pôster chegam via parâmetro de rota (mandados por
 * `ReviewsSection.tsx` ao navegar) — evita buscar os detalhes da
 * série de novo só pra isso.
 */
export default function SeriesReviewsScreen() {
  /*
   * A BARRA DE NAVEGAÇÃO AGORA APARECE NESTA TELA TAMBÉM (2026-09-09,
   * decisão do usuário) — ela subiu pro layout raiz (`app/_layout.tsx`),
   * como no web. Sendo `position: absolute`, ela não reserva espaço
   * sozinha: sem esta folga no fim do conteúdo, o último item ficaria
   * atrás dela. Mesma conta que as telas de aba já usavam.
   */
  const espacoDoDock = useTabBarClearance();
  const { t } = useTranslation();
  const { id, title, posterPath } = useLocalSearchParams<{ id: string; title: string; posterPath: string }>();
  const numericId = Number(id);

  return (
    <Screen padded={false}>
      {/*
        PORTE DO WEB (2026-09-09, comparado no print) — o cabeçalho
        desta tela é o do `CommentsPageView.tsx`:
        `flex items-center gap-3 border-b border-white/10 px-4 py-3`.
        FASE 2 (consistência visual sistêmica, 2026-09-26) — convertido
        pro `<ScreenHeader>` compartilhado (título/ícone já batiam com a
        referência); a linha divisória embaixo é uma necessidade visual
        real desta tela (web tem, o grupo "voltar+título" comum não tem)
        — mantida via o `style` de escape hatch do componente.
      */}
      <ScreenHeader title={t("social.reviews")} style={styles.header} />

      {/*
        * PORTE DO WEB (2026-09-04, "vidro que falta") — campo de
        * manchas de fundo igual ao das telas de Comentários do web
        * (`CommentsPageView.tsx`), que é o equivalente lá desta tela
        * (ver docstring acima). O `GlassTargetProvider` é o que faz os
        * cards `<Glass>` de dentro (`ReviewComposer`/`ReviewCard`/
        * `ReviewSummary`) terem o que borrar.
        */}
      <GlassTargetProvider style={styles.glassFill} background={<AmbientGlow blobs={SUBPAGE_GLOW_BLOBS} />}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: espacoDoDock }]}>
          <ReviewsFullView
            target={{ mediaType: "series", mediaId: numericId }}
            media={{ title: title ?? "", posterPath: posterPath || null }}
          />
        </ScrollView>
      </GlassTargetProvider>
    </Screen>
  );
}

const styles = StyleSheet.create({
  glassFill: {
    flex: 1,
  },
  /**
   * FASE 2 (2026-09-26) — a linha divisória embaixo do cabeçalho
   * (`border-b border-white/10` do web) é a única diferença real
   * desta tela em relação ao `<ScreenHeader>` padrão; aplicada via o
   * `style` de escape hatch do componente, sem herdar o resto do
   * grupo "voltar+título" comum.
   */
  header: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  /** O `PageContainer` do web entra com `pt-6` e o conteúdo com `py-4` por dentro — 40 no total antes do primeiro card. Aqui não havia respiro nenhum. */
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: 40,
    paddingBottom: spacing.xl,
  },
});
