import { useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import type { ReviewTarget } from "@/lib/social/reviews";
import { useReviews } from "@/lib/social/useReviews";
import { createReviewPost } from "@/lib/posts";
import { Text } from "@/components/ui";
import { ReviewComposer } from "./ReviewComposer";
import { ReviewCard } from "./ReviewCard";
import { colors, spacing } from "@/lib/theme";

export interface ReviewsSectionProps {
  target: ReviewTarget;
  media: { title: string; posterPath: string | null };
}

/**
 * TASK-101 (Avaliações) — porta de `ReviewsSection.tsx`. Salvar a
 * avaliação e publicar no Feed são duas escritas separadas (mesma
 * ordem do web): primeiro grava a review; só se "Publicar também no
 * Feed" estiver marcado, cria o post depois — se o post falhar, a
 * avaliação já está salva de qualquer forma (não perde o que a
 * pessoa escreveu por causa de um problema no Feed).
 */
export function ReviewsSection({ target, media }: ReviewsSectionProps) {
  const { othersReviews, myReview, isLoading, saving, submit, remove } = useReviews(target);
  const [postError, setPostError] = useState<string | null>(null);

  async function handleSubmit(rating: number, reviewText: string | null, containsSpoiler: boolean, shareToFeed: boolean) {
    setPostError(null);
    const ok = await submit(rating, reviewText, containsSpoiler);
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
      console.error("[ReviewsSection] Avaliação salva, mas falhou ao publicar no Feed", error);
      setPostError("Avaliação salva, mas não foi possível publicar no Feed agora.");
    }
  }

  return (
    <View style={styles.wrapper}>
      <ReviewComposer
        initialRating={myReview?.rating ?? 0}
        initialText={myReview?.reviewText ?? ""}
        initialSpoiler={myReview?.containsSpoiler ?? false}
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
        <Text variant="muted" style={styles.centerText}>
          Carregando avaliações...
        </Text>
      ) : othersReviews.length === 0 ? (
        <Text variant="muted" style={styles.centerText}>
          Nenhuma outra avaliação ainda.
        </Text>
      ) : (
        <View style={styles.list}>
          {othersReviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
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
