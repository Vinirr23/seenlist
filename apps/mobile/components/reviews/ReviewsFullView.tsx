import { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import type { ReviewTarget } from "@/lib/social/reviews";
import { useReviews } from "@/lib/social/useReviews";
import { createReviewPost } from "@/lib/posts";
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
import { colors, spacing } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export interface ReviewsFullViewProps {
  target: ReviewTarget;
  media: { title: string; posterPath: string | null };
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
export function ReviewsFullView({ target, media }: ReviewsFullViewProps) {
  const { t } = useTranslation();
  const { othersReviews, myReview, isLoading, saving, submit, remove } = useReviews(target);
  const [postError, setPostError] = useState<string | null>(null);
  const [promptRating, setPromptRating] = useState<number | null>(null);
  const [showRecommendSheet, setShowRecommendSheet] = useState(false);

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
   * DECISÃO DE PRODUTO (a pedido — aba Feed descontinuada) — a
   * avaliação não é mais publicada no Feed, e a caixa "Publicar
   * também no Feed" saiu do formulário: oferecer publicar num lugar
   * que ninguém consegue mais abrir seria enganoso.
   *
   * O parâmetro `shareToFeed` continua na assinatura porque o
   * `ReviewComposer` é compartilhado — ele só chega sempre `false`
   * agora, já que a caixa não é mais renderizada.
   */
  async function handleSubmit(rating: number, reviewText: string | null, shareToFeed: boolean) {
    setPostError(null);
    const ok = await submit(rating, reviewText, false);
    if (!ok) return;

    /*
     * A PEDIDO — convite pra recomendar depois de nota alta. Roda
     * DEPOIS de a avaliação ter sido salva com sucesso (nunca
     * interrompe o fluxo principal), e as regras de quando aparecer
     * ficam todas em `lib/recommendPrompt.ts`.
     */
    shouldShowRecommendPrompt(rating, { mediaType: target.mediaType, mediaId: target.mediaId }).then((show) => {
      if (!show) return;
      setPromptRating(rating);
      markRecommendPromptShown();
    });

    if (!shareToFeed) return;

    try {
      await createReviewPost(reviewText ?? "", {
        mediaType: target.mediaType,
        mediaId: target.mediaId,
        mediaTitle: media.title,
        mediaPosterPath: media.posterPath,
        rating,
      });
    } catch (error) {
      console.error("[ReviewsFullView] Avaliação salva, mas falhou ao publicar no Feed", error);
      setPostError(t("review.savedButFeedPublishFailed"));
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

      <ReviewComposer
        initialRating={myReview?.rating ?? 0}
        initialText={myReview?.reviewText ?? ""}
        hasExistingReview={!!myReview}
        isPending={saving}
        onSubmit={handleSubmit}
        /* PORTE DO WEB (2026-09-09) — "Remover minha avaliação" passou pra DENTRO do card, na mesma linha do botão de salvar, como no `ReviewFullComposer.tsx`. */
        onDelete={remove}
        isDeleting={saving}
      />
      {!!postError && (
        <Text variant="error" style={styles.postError}>
          {postError}
        </Text>
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
});
