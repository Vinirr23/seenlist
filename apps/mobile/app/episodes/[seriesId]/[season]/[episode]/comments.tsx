import { ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { EpisodeCommentsSection } from "@/components/episode/EpisodeCommentsSection";
import { EpisodeCommentComposerButton } from "@/components/episode/EpisodeCommentComposerButton";
import { useEpisodeComments } from "@/lib/social/useEpisodeComments";
import { Screen, ScreenHeader } from "@/components/ui";
import { spacing, colors } from "@/lib/theme";
import { useTabBarClearance } from "@/lib/useTabBarClearance";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * TASK-122 (episódio) — porta de `CommentsPageView.tsx`: tela própria
 * (não mais embutida na tela de detalhes do episódio), igual ao web.
 *
 * HOOK LEVANTADO PRA AQUI (2026-10-06, a pedido — "o (+) e no topo um
 * quadrado pra escrever comentário são redundantes") — `useEpisodeComments(target)`
 * antes era chamado DENTRO de `EpisodeCommentsSection` (que também
 * tinha o composer inline). Esse composer saiu (ver comentário em
 * `EpisodeCommentsSection.tsx`) e foi substituído pelo "+" dedicado
 * (`EpisodeCommentComposerButton`, abaixo) — como agora DOIS lugares
 * desta tela precisam do mesmo `submit`/`tree`/etc. (a lista e o
 * composer), o hook subiu pra cá, chamado UMA SÓ VEZ (ele não tem
 * cache compartilhado — chamar duas vezes criaria dois estados
 * independentes, buscando/duplicando por conta própria), e desce como
 * props pros dois.
 */
export default function EpisodeCommentsScreen() {
  const { t } = useTranslation();
  const { seriesId, season, episode } = useLocalSearchParams<{ seriesId: string; season: string; episode: string }>();
  const seriesIdNum = Number(seriesId);
  const seasonNumber = Number(season);
  const episodeNumber = Number(episode);
  const espacoDoDock = useTabBarClearance();

  const target = { mediaType: "series" as const, mediaId: seriesIdNum, seasonNumber, episodeNumber };
  const { tree, isLoading, isError, sending, submit, remove, edit, retry } = useEpisodeComments(target);
  const commentsBaseHref = `/episodes/${seriesIdNum}/${seasonNumber}/${episodeNumber}`;

  return (
    <Screen padded={false}>
      {/*
        * CORREÇÃO (auditoria de consistência, Fase 2, 2026-09-26) —
        * título estava fixo em "Comentários" (não traduzido); nova
        * chave `social.commentsTitle` (traduzida nas 3 línguas) e
        * `<ScreenHeader>` compartilhado, mesmo padrão das outras
        * telas simples de voltar+título.
        */}
      <ScreenHeader title={t("social.commentsTitle")} />

      {/*
        * VIDRO REMOVIDO (2026-10-06, a pedido — "em séries/episódios é
        * só pra tirar o glass completamente e adicionar o (+)") — sem
        * `GlassTargetProvider`/`AmbientGlow` nem alvo de borrão pro
        * composer/cartões de comentário (`EpisodeCommentsSection`/
        * `EpisodeCommentItem`, agora planos, mesma receita do Feed).
        */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: espacoDoDock }]}>
          <EpisodeCommentsSection
            tree={tree}
            isLoading={isLoading}
            isError={isError}
            retry={retry}
            remove={remove}
            edit={edit}
            commentsBaseHref={commentsBaseHref}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/*
        * "+" DE COMENTÁRIO (2026-10-06, a pedido) — era o
        * `CreatePostButton` genérico do Feed (redundante com o
        * composer que existia no topo da lista, e que só publicava no
        * Feed geral, não como comentário de episódio de verdade — ver
        * comentário grande em `EpisodeCommentComposerButton.tsx`).
        * Agora é este componente dedicado, com "contém spoiler" e sem
        * enquete, submetendo pelo `submit` deste hook.
        */}
      <EpisodeCommentComposerButton onSubmit={submit} sending={sending} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.md,
    /**
     * CORREÇÃO (2026-09-25, bug reportado — "respondi um comentário e
     * ficou por trás da barra de navegação") — esta tela nunca chamava
     * `useTabBarClearance()`, então só tinha o `paddingBottom` estático
     * abaixo (`spacing.xl`), insuficiente pra reservar espaço pro dock
     * flutuante (`position: absolute`, não reserva espaço sozinho — ver
     * comentário do próprio hook em `useTabBarClearance.ts`, "VALE PRA
     * TODAS AS TELAS"). O valor dinâmico é aplicado no array de estilo
     * do `ScrollView` abaixo e substitui este fallback estático.
     */
    paddingBottom: spacing.xl,
  },
});
