import { useEffect, useRef, useState } from "react";
import { View, Alert, Pressable, Share, ActivityIndicator, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { ReviewTarget } from "@/lib/social/reviews";
import { useReviews } from "@/lib/social/useReviews";
import { createReviewPost, syncReviewPostRating } from "@/lib/posts";
import { reviewShareUrl } from "@/lib/shareLinks";
import {
  shouldShowRecommendPrompt,
  markRecommendPromptShown,
  markRecommendPromptDismissed,
  markRecommendPromptAccepted,
} from "@/lib/recommendPrompt";
import { RecommendPromptSheet } from "@/components/social/RecommendPromptSheet";
import { RecommendSheet } from "@/components/social/RecommendSheet";
import { fetchLikeInfoFor } from "@/lib/social/likes";
import { Text } from "@/components/ui";
import { AvatarRowSkeleton } from "@/components/media/AvatarRowSkeleton";
import { ReviewComposer } from "./ReviewComposer";
import { ReviewCard } from "./ReviewCard";
import { colors, fontSize, radius, spacing } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export interface ReviewsFullViewProps {
  target: ReviewTarget;
  media: { title: string; posterPath: string | null };
  /** A PEDIDO (2026-09-25, filme — ver comentário em `ReviewComposer.tsx`) — repassado pro composer; default `true` mantém série como está. */
  showRating?: boolean;
}

/**
 * A PEDIDO (implementar tudo igual ao web) — conteúdo da tela
 * "Avaliações" separada (`app/series/[id]/reviews.tsx` /
 * `app/movies/[id]/reviews.tsx`), mesma estrutura de
 * `ReviewTextSection.tsx` do web: formulário completo (nota + texto
 * + Publicar no Feed) + lista de avaliações de outras pessoas.
 *
 * Salvar a avaliação e publicar no Feed são duas escritas separadas
 * (mesma ordem do web): primeiro grava a review; só se "Publicar
 * também no Feed" estiver marcado, publica depois — se o post
 * falhar, a avaliação já está salva de qualquer forma.
 */
export function ReviewsFullView({ target, media, showRating = true }: ReviewsFullViewProps) {
  const { t } = useTranslation();
  const { othersReviews, myReview, isLoading, saving, submit, remove, hasMore, loadingMore, loadMore } = useReviews(target);
  const [postError, setPostError] = useState<string | null>(null);
  const [promptRating, setPromptRating] = useState<number | null>(null);
  const [showRecommendSheet, setShowRecommendSheet] = useState(false);
  /** A PEDIDO (2026-10-08, "Compartilhamento social", Fase 1) — sugestão discreta pós-publicação, sem modal novo; aparece só depois de salvar com sucesso, some ao tocar em compartilhar/fechar ou ao editar de novo. */
  const [showShareSuggestion, setShowShareSuggestion] = useState(false);

  /**
   * BUG REAL CORRIGIDO (2026-10-08, reportado — "minha avaliação já
   * publicada aparece como se eu ainda estivesse digitando") — causa
   * raiz: a própria avaliação SEMPRE aparecia como formulário aberto
   * (`ReviewComposer`), mesmo já salva há dias. Corrigido: com
   * conteúdo já existente, mostra fechada (`ReviewCard`, igual à de
   * qualquer outra pessoa) com um botão de editar que abre o
   * formulário só quando a pessoa realmente quer mudar algo.
   *
   * `hasReviewContent` (não `!!myReview` puro) — pra FILME
   * (`showRating: false`), a nota já vem de outro lugar (aba "Mais") e
   * quase sempre existe uma linha em `reviews` antes mesmo da pessoa
   * escrever um comentário aqui; se fechasse o card só por existir
   * linha, a tela "virava card fechado sem texto" bem na hora que a
   * pessoa só queria escrever o primeiro comentário. Pra filme, só
   * fecha quando já existe TEXTO; pra série (`showRating: true`,
   * nota editada aqui mesmo), qualquer avaliação existente fecha,
   * igual antes.
   */
  const hasExistingReview = !!myReview;
  const hasReviewContent = showRating ? hasExistingReview : !!myReview?.reviewText;
  const [isEditing, setIsEditing] = useState(!hasReviewContent);
  const prevHasReviewContentRef = useRef(hasReviewContent);
  useEffect(() => {
    if (prevHasReviewContentRef.current !== hasReviewContent) {
      setIsEditing(!hasReviewContent);
      prevHasReviewContentRef.current = hasReviewContent;
    }
  }, [hasReviewContent]);

  /** TASK-153 — busca a curtida de TODAS as avaliações visíveis de uma vez, não uma por uma. */
  const [likeInfoByReviewId, setLikeInfoByReviewId] = useState<Map<string, { count: number; hasLiked: boolean }>>(new Map());
  useEffect(() => {
    if (othersReviews.length === 0) return;
    fetchLikeInfoFor(
      "review",
      othersReviews.map((r) => r.id)
    )
      .then(setLikeInfoByReviewId)
      .catch((error) => console.error("[ReviewsFullView] Falha ao buscar curtidas em lote", error));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [othersReviews.map((r) => r.id).join(",")]);

  /*
   * RELIGADO (a pedido, 2026-09-28 — Feed voltou como sub-aba de
   * Explorar) — a caixa "Publicar também no Feed" volta a aparecer
   * (`canShareToFeed` no `<ReviewComposer>`, abaixo).
   *
   * ACHADO REAL nesta mesma volta: mesmo com a caixa escondida (todo
   * este tempo com `canShareToFeed` ausente), o estado interno
   * `shareToFeed` do `ReviewComposer` sempre começou como
   * `!hasExistingReview` — ou seja, `true` pra toda avaliação NOVA,
   * INDEPENDENTE da caixa aparecer ou não — e esse valor sempre foi
   * repassado pro `onSubmit` daqui. Resultado: toda avaliação nova
   * escrita enquanto o Feed estava "descontinuado" foi silenciosamente
   * publicada como post mesmo assim (ninguém via, mas o post existia).
   * Religar a caixa não introduz esse comportamento — só o torna
   * visível/intencional de novo, como era antes de 2026-08-22.
   */
  /**
   * BUG REAL CORRIGIDO (2026-10-01, reportado — nota "zerada" no post
   * do Feed, e post dessincronizado de uma nota dada depois) —
   * `rating` agora é `number | null` (vem do `ReviewComposer`: `null`
   * quando esta tela não edita nota, `showRating: false`, caso de
   * filme). `effectiveRating` resolve pra nota de verdade a usar no
   * post/convite de recomendar: a que acabou de ser enviada (série,
   * ou filme com `showRating: true`), OU a que já existia (`myReview`,
   * ainda não recarregado pelo `submit()` acima — por isso usa o
   * valor local, não espera recarregar) quando esta tela só mexeu no
   * texto. `null` nos dois (nunca houve nota) não dispara nem convite
   * de recomendar nem grava nota no post.
   */
  async function handleSubmit(rating: number | null, reviewText: string | null, shareToFeed: boolean) {
    setPostError(null);
    setShowShareSuggestion(false);
    const ok = await submit(rating, reviewText, false);
    if (!ok) return;
    setShowShareSuggestion(true);
    setIsEditing(false);

    const effectiveRating = rating ?? myReview?.rating ?? null;

    /*
     * A PEDIDO — convite pra recomendar depois de nota alta. Roda
     * DEPOIS de a avaliação ter sido salva com sucesso (nunca
     * interrompe o fluxo principal), e as regras de quando aparecer
     * ficam todas em `lib/recommendPrompt.ts`.
     */
    if (effectiveRating !== null) {
      shouldShowRecommendPrompt(effectiveRating, { mediaType: target.mediaType, mediaId: target.mediaId }).then((show) => {
        if (!show) return;
        setPromptRating(effectiveRating);
        markRecommendPromptShown();
      });
    }

    // Mantém um post de review já publicado anteriormente (se existir)
    // com a nota ATUAL — ver comentário grande em `syncReviewPostRating`
    // (`lib/posts.ts`). Sem isso, só a avaliação em si ficaria
    // atualizada; o post já no Feed continuaria preso na nota antiga.
    if (effectiveRating !== null) {
      syncReviewPostRating(target.mediaType, target.mediaId, effectiveRating).catch((error) => {
        console.error("[ReviewsFullView] Falha ao sincronizar nota do post já publicado", error);
      });
    }

    /*
     * REGRA (2026-10-06, "Activity vs. Post de Review", auditoria
     * aprovada pelo usuário) — quando o texto fica vazio, `createReviewPost`
     * precisa ser chamado DE QUALQUER FORMA (mesmo com `shareToFeed`
     * false, que é o estado forçado pelo `ReviewComposer` quando não há
     * texto): é ela quem apaga um post já publicado anteriormente, se
     * existir — a nota continua em `reviews` e passa a aparecer como
     * Activity. Só pula a chamada quando HÁ texto mas a pessoa optou
     * explicitamente por não publicar (`shareToFeed` false) — nesse
     * caso um post já existente, se houver, é mantido como está.
     */
    const trimmedText = (reviewText ?? "").trim();
    if (!shareToFeed && trimmedText.length > 0) return;

    try {
      await createReviewPost(trimmedText, {
        mediaType: target.mediaType,
        mediaId: target.mediaId,
        mediaTitle: media.title,
        mediaPosterPath: media.posterPath,
        rating: effectiveRating,
      });
    } catch (error) {
      console.error("[ReviewsFullView] Avaliação salva, mas falhou ao publicar no Feed", error);
      setPostError(t("review.savedButFeedPublishFailed"));
    }
  }

  /**
   * FASE 2 (consistência visual sistêmica, Task 9 "ações e feedback",
   * 2026-09-26) — achado real na auditoria: apagar uma avaliação não
   * tinha NENHUMA confirmação (comentário/post sempre confirmam com
   * `Alert.alert`, mesmo texto/estilo usado aqui agora) e falha virava
   * só um `console.error`, sem a pessoa nunca saber que não funcionou.
   * `remove()` agora devolve `true`/`false` (ver `useReviews.ts`) —
   * usado aqui pra reaproveitar o mesmo `postError` já existente na
   * tela em vez de inventar um segundo mecanismo de erro.
   */
  function handleDeleteReview() {
    Alert.alert(t("review.confirmDeleteReviewTitle"), t("review.confirmDeleteReviewMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("social.delete"),
        style: "destructive",
        onPress: async () => {
          setPostError(null);
          setShowShareSuggestion(false);
          const ok = await remove();
          if (!ok) setPostError(t("review.errorDeleteReview"));
        },
      },
    ]);
  }

  async function handleShareMyReview() {
    if (!myReview) return;
    setShowShareSuggestion(false);
    try {
      await Share.share({ message: reviewShareUrl(myReview.id) });
    } catch (error) {
      console.error("[ReviewsFullView] Falha ao compartilhar avaliação", error);
    }
  }

  function handleDismissPrompt() {
    setPromptRating(null);
    markRecommendPromptDismissed();
  }

  function handleAcceptPrompt() {
    setPromptRating(null);
    markRecommendPromptAccepted();
    setShowRecommendSheet(true);
  }

  return (
    <View style={styles.wrapper}>
      {promptRating !== null && (
        <RecommendPromptSheet
          mediaTitle={media.title}
          posterPath={media.posterPath}
          rating={promptRating}
          onRecommend={handleAcceptPrompt}
          onDismiss={handleDismissPrompt}
        />
      )}

      {showRecommendSheet && (
        <RecommendSheet
          mediaType={target.mediaType}
          mediaId={target.mediaId}
          mediaTitle={media.title}
          onClose={() => setShowRecommendSheet(false)}
        />
      )}

      {isEditing || !myReview ? (
        <ReviewComposer
          initialRating={myReview?.rating ?? 0}
          initialText={myReview?.reviewText ?? ""}
          hasExistingReview={hasExistingReview}
          isPending={saving}
          canShareToFeed
          showRating={showRating}
          onSubmit={handleSubmit}
          /* PORTE DO WEB (2026-09-09) — "Remover minha avaliação" passou pra DENTRO do card, na mesma linha do botão de salvar, como no `ReviewFullComposer.tsx`. */
          onDelete={handleDeleteReview}
          isDeleting={saving}
          onCancel={hasReviewContent ? () => setIsEditing(false) : undefined}
        />
      ) : (
        <ReviewCard review={myReview} onEdit={() => setIsEditing(true)} />
      )}
      {!!postError && (
        <Text variant="error" style={styles.postError}>
          {postError}
        </Text>
      )}

      {showShareSuggestion && !!myReview && (
        <View style={styles.shareSuggestion}>
          <Text variant="muted" style={styles.shareSuggestionText}>
            {t("review.shareSuggestion")}
          </Text>
          <Pressable onPress={handleShareMyReview} style={styles.shareSuggestionAction} hitSlop={8}>
            <Feather name="share-2" size={13} color={colors.primary} />
            <Text style={styles.shareSuggestionActionText}>{t("social.share")}</Text>
          </Pressable>
          <Pressable onPress={() => setShowShareSuggestion(false)} hitSlop={8}>
            <Feather name="x" size={14} color={colors.muted} />
          </Pressable>
        </View>
      )}

      {isLoading ? (
        <AvatarRowSkeleton count={3} />
      ) : othersReviews.length === 0 ? (
        /*
          PORTE DO WEB (2026-09-09, comparado no print) — aqui havia um
          `EmptyShelf`: card de vidro com borda tracejada e uma estrela
          dentro de um círculo. O web usa o `EmptyState`
          (`components/search/EmptyState.tsx`), que não tem card nem
          ícone nenhum — só o texto em `text-sm text-muted`,
          centralizado, com `py-16` (64) de respiro.
        */
        <View style={styles.emptyState}>
          <Text variant="muted" style={styles.emptyStateText}>
            {t("review.noOtherReviewsYet")}
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {othersReviews.map((review) => (
            <ReviewCard key={review.id} review={review} initial={likeInfoByReviewId.get(review.id)} />
          ))}
          {/*
            CORREÇÃO DE DESEMPENHO (2026-09-27, Etapa 2, item 2 —
            "Reviews: paginação") — antes `fetchReviews` trazia TODAS
            as avaliações do título de uma vez; agora vem paginado (20
            por vez, ver `useReviews.ts`/`reviews.ts`), e este botão
            busca a próxima página sob demanda — mesmo padrão visual
            (`Glass` + `explore.discover.loadMore`) já usado em
            `DiscoverGridScreen.tsx`. Botão, não `onEndReached`: esta
            lista já mora dentro do `ScrollView` da tela de Avaliações
            (`app/series/[id]/reviews.tsx`/`app/movies/[id]/reviews.tsx`),
            então não há `FlatList` próprio aqui pra disparar por
            scroll — trocar por `FlatList` exigiria mexer nas duas
            telas donas do `ScrollView` (risco maior, fora do escopo
            desta etapa).
          */}
          {hasMore && (
            <Pressable
              onPress={loadMore}
              disabled={loadingMore}
              style={[styles.loadMoreButton, loadingMore && styles.loadMoreButtonDisabled]}
            >
              {loadingMore ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={styles.loadMoreText}>{t("explore.discover.loadMore")}</Text>
              )}
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.md,
  },
  postError: {
    marginTop: -spacing.xs,
  },
  /** A PEDIDO (2026-10-08, "Compartilhamento social", Fase 1) — linha discreta, sem card/vidro, sem modal. */
  shareSuggestion: {
    marginTop: -spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  shareSuggestionText: {
    flex: 1,
    fontSize: fontSize.sm,
  },
  shareSuggestionAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  shareSuggestionActionText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.primary,
  },
  /** `space-y-3` = 12 entre as avaliações no web (era `spacing.sm` = 8). */
  list: {
    gap: 12,
  },
  /** `flex flex-col items-center justify-center gap-1 py-16 text-center`. */
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 64,
  },
  emptyStateText: {
    textAlign: "center",
  },
  /**
   * VIDRO REMOVIDO (2026-10-06, a pedido) — era `<Glass>`; mesma
   * superfície plana usada no resto desta tela agora.
   */
  loadMoreButton: {
    marginTop: spacing.xs,
    alignSelf: "center",
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  loadMoreButtonDisabled: {
    opacity: 0.6,
  },
  loadMoreText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text,
  },
});
