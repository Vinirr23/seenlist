import { View, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import type { Review } from "@/lib/social/reviews";
import { Text, Glass } from "@/components/ui";
import { VerifiedBadge } from "@/components/common/VerifiedBadge";
import { StarRating } from "./StarRating";
import { SpoilerGate } from "./SpoilerGate";
import { LikeButton } from "@/components/feed/LikeButton";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

/**
 * PORTE DO WEB (2026-09-04, "vidro que falta") — vira `<Glass>` (web:
 * "mesma textura de card neutro do resto do app").
 */
export function ReviewCard({ review, initial }: { review: Review; initial?: { count: number; hasLiked: boolean } }) {
  const router = useRouter();

  return (
    <Glass style={styles.card}>
      <View style={styles.header}>
        <Pressable style={styles.authorRow} onPress={() => router.push(`/u/${review.author.username}`)}>
          <Text style={styles.authorName}>{review.author.displayName ?? review.author.username}</Text>
          <VerifiedBadge tier={review.author.verifiedTier} size={fontSize.md} />
          <Text variant="muted" style={styles.date}>
            {dateFormatter.format(new Date(review.createdAt))}
          </Text>
        </Pressable>
        <StarRating value={review.rating ?? 0} size="sm" />
      </View>

      {!!review.reviewText && (
        <SpoilerGate hidden={review.containsSpoiler}>
          <Text style={styles.text}>{review.reviewText}</Text>
        </SpoilerGate>
      )}

      <LikeButton targetType="review" targetId={review.id} initial={initial} />
    </Glass>
  );
}

const styles = StyleSheet.create({
  // `Glass` não define raio — web usa `rounded-2xl` (16px) = `radius.lg`.
  card: {
    gap: spacing.xs,
    borderRadius: radius.lg,
    padding: spacing.sm + 2,
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
