import { ScrollView, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ReviewsFullView } from "@/components/reviews/ReviewsFullView";
import { Screen, ScreenHeader } from "@/components/ui";
import { spacing, colors } from "@/lib/theme";
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
        * VIDRO REMOVIDO (2026-10-06, a pedido — "em séries/episódios é
        * só pra tirar o glass completamente e adicionar o (+)") — sem
        * `GlassTargetProvider`/`AmbientGlow` nem alvo de borrão pros
        * cards de dentro (`ReviewComposer`/`ReviewCard`, agora planos,
        * mesma receita de superfície do Feed). `styles.glassFill` saiu
        * junto — era só o container do provider.
        */}
      <ScrollView style={styles.flex} contentContainerStyle={[styles.content, { paddingBottom: espacoDoDock }]}>
        <ReviewsFullView
          target={{ mediaType: "series", mediaId: numericId }}
          media={{ title: title ?? "", posterPath: posterPath || null }}
        />
      </ScrollView>

      {/*
        * "+" REMOVIDO (2026-10-06, a pedido — "tira o (+) de avaliações
        * de séries") — tinha sido adicionado aqui junto com a remoção
        * do glass; "Publicar também no Feed" dentro do próprio
        * `ReviewComposer` já cobre quem quer compartilhar a review, e
        * o "+" genérico (`CreatePostButton`) não tinha propósito
        * próprio nesta tela (ao contrário da de comentários de
        * episódio, onde virou um composer dedicado de verdade — ver
        * `EpisodeCommentComposerButton.tsx`).
        */}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
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
