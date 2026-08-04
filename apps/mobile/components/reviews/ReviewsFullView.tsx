import { useEffect, useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import type { ReviewTarget } from "@/lib/social/reviews";
import { useReviews } from "@/lib/social/useReviews";
import { createReviewPost } from "@/lib/posts";
import { fetchLikeInfoFor } from "@/lib/social/likes";
import { Text } from "@/components/ui";
import { AvatarRowSkeleton } from "@/components/media/AvatarRowSkeleton";
import { ReviewComposer } from "./ReviewComposer";
import { ReviewCard } from "./ReviewCard";
import { colors, spacing } from "@/lib/theme";

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
  const { othersReviews, myReview, isLoading, saving, submit, remove } = useReviews(target);
  const [postError, setPostError] = useState<string | null>(null);

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

  async function handleSubmit(rating: number, reviewText: string | null, shareToFeed: boolean) {
    setPostError(null);
    const ok = await submit(rating, reviewText, false);
    if (!ok || !shareToFeed) return;

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
      setPostError("Avaliação salva, mas não foi possível publicar no Feed agora.");
    }
  }

  return (
    <View style={styles.wrapper}>
      <ReviewComposer
        initialRating={myReview?.rating ?? 0}
        initialText={myReview?.reviewText ?? ""}
        hasExistingReview={!!myReview}
        isPending={saving}
        canShareToFeed
        onSubmit={handleSubmit}
      />
      {!!postError && (
        <Text variant="error" style={styles.postError}>
          {postError}
        </Text>
      )}

      {!!myReview && (
        <Pressable onPress={remove} disabled={saving}>
          <Text variant="error" style={styles.removeLink}>
            Remover minha avaliação
          </Text>
        </Pressable>
      )}

      {isLoading ? (
        <AvatarRowSkeleton count={3} />
      ) : othersReviews.length === 0 ? (
        <Text variant="muted" style={styles.centerText}>
          Nenhuma outra avaliação ainda.
        </Text>
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
  removeLink: {
    fontSize: 12,
    fontWeight: "600",
  },
  list: {
    gap: spacing.sm,
  },
  centerText: {
    textAlign: "center",
    paddingVertical: spacing.md,
  },
});
