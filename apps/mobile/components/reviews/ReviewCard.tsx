import { View, Pressable, Share, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { Review } from "@/lib/social/reviews";
import { Text } from "@/components/ui";
import { VerifiedBadge } from "@/components/common/VerifiedBadge";
import { reviewShareUrl } from "@/lib/shareLinks";
import { StarRating } from "./StarRating";
import { SpoilerGate } from "./SpoilerGate";
import { LikeButton } from "@/components/feed/LikeButton";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

/**
 * VIDRO REMOVIDO (2026-10-06, a pedido — "em séries/episódios é só
 * pra tirar o glass completamente") — era `<Glass>` desde o porte do
 * web (2026-09-04); virou superfície plana, mesma receita do Feed.
 *
 * A PEDIDO (2026-10-08 — "Compartilhamento social", Fase 1) — botão
 * de compartilhar permanente, mesmo padrão de `ProfileMoreSheet.tsx`
 * (`Share.share` nativo, sem modal novo). `review.id` já estava
 * disponível aqui (já usado pelo `LikeButton`) — não precisou
 * receber `target`/`media` como prop.
 */
export function ReviewCard({ review, initial }: { review: Review; initial?: { count: number; hasLiked: boolean } }) {
  const router = useRouter();

  async function handleShare() {
    try {
      await Share.share({ message: reviewShareUrl(review.id) });
    } catch (error) {
      console.error("[ReviewCard] Falha ao compartilhar review", error);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Pressable style={styles.authorRow} onPress={() => router.push(`/u/${review.author.username}`)}>
          <Text style={styles.authorName}>{review.author.displayName ?? review.author.username}</Text>
          <VerifiedBadge tier={review.author.verifiedTier} size={fontSize.md} />
          <Text variant="muted" style={styles.date}>
            {dateFormatter.format(new Date(review.createdAt))}
          </Text>
        </Pressable>
        <View style={styles.headerRight}>
          <StarRating value={review.rating ?? 0} size="sm" />
          <Pressable onPress={handleShare} accessibilityLabel="Compartilhar avaliação" hitSlop={8}>
            <Feather name="share-2" size={15} color={colors.muted} />
          </Pressable>
        </View>
      </View>

      {!!review.reviewText && (
        <SpoilerGate hidden={review.containsSpoiler}>
          <Text style={styles.text}>{review.reviewText}</Text>
        </SpoilerGate>
      )}

      <LikeButton targetType="review" targetId={review.id} initial={initial} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.xs,
    borderRadius: radius.lg,
    padding: spacing.sm + 2,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  // A PEDIDO (mockup "Opção B", 2026-09-25, aplicado antes só nos
  // comentários — "aplica o mesmo aumento de fonte nas avaliações
  // também, pra ficar consistente") — 13 → 16, mesma proporção de
  // `authorName` em `EpisodeCommentItem.tsx`/`comment/[commentId].tsx`.
  // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.md` (era literal 16, mesmo valor).
  authorName: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.text,
  },
  // A PEDIDO (mockup "Opção B", 2026-09-25) — 11 → 13.
  // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.xsPlus` (era literal 13, mesmo valor).
  date: {
    fontSize: fontSize.xsPlus,
  },
  // A PEDIDO (mockup "Opção B", 2026-09-25) — 13 → 16.
  // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.md` (era literal 16, mesmo valor).
  text: {
    fontSize: fontSize.md,
    color: colors.text,
  },
});
