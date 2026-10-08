import { useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { Review } from "@/lib/social/reviews";
import { Text } from "@/components/ui";
import { VerifiedBadge } from "@/components/common/VerifiedBadge";
import { reviewShareUrl, reviewShareImageUrl, reviewStoryImageUrl } from "@/lib/shareLinks";
import { StarRating } from "./StarRating";
import { SpoilerGate } from "./SpoilerGate";
import { LikeButton } from "@/components/feed/LikeButton";
import { SharePreviewSheet } from "@/components/social/SharePreviewSheet";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

/**
 * VIDRO REMOVIDO (2026-10-06, a pedido — "em séries/episódios é só
 * pra tirar o glass completamente") — era `<Glass>` desde o porte do
 * web (2026-09-04); virou superfície plana, mesma receita do Feed.
 *
 * A PEDIDO (2026-10-08 — "Compartilhamento social", Fase 1) — botão
 * de compartilhar permanente. `review.id` já estava disponível aqui
 * (já usado pelo `LikeButton`) — não precisou receber `target`/`media`
 * como prop.
 *
 * A PEDIDO (2026-10-08, extensão depois de testar no Threads —
 * "quero uma interface de pré-visualização antes de compartilhar"):
 * `handleShare` não chama mais `Share.share` direto — abre o
 * `SharePreviewSheet` mostrando o card visual gerado por
 * `opengraph-image.tsx` (mesma imagem que aparece na prévia do
 * Threads/WhatsApp), com botão de compartilhar ali dentro.
 *
 * REDESIGN (2026-10-08, "estilo Unwind" — mockup aprovado, decisão
 * explícita do usuário: "Compartilhar link" e "Exportar pra Stories"
 * são DUAS ações distintas, nunca uma substitui a outra) — passa
 * também `reviewStoryImageUrl(review.id)` pro `SharePreviewSheet`,
 * que agora decide internamente qual ação cada botão dispara. Ver
 * `story-image/route.ts` (web) pro porquê do formato vertical ser uma
 * rota separada da prévia OG, nunca a mesma imagem.
 */
export function ReviewCard({
  review,
  initial,
  onEdit,
}: {
  review: Review;
  initial?: { count: number; hasLiked: boolean };
  /** A PEDIDO (2026-10-08, reportado — "minha avaliação já publicada aparece como se eu ainda estivesse digitando") — só passado por `ReviewsFullView.tsx` pra MOSTRAR a própria avaliação; review de outra pessoa nunca recebe. */
  onEdit?: () => void;
}) {
  const router = useRouter();
  const [showSharePreview, setShowSharePreview] = useState(false);

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
          {onEdit && (
            <Pressable onPress={onEdit} accessibilityLabel="Editar avaliação" hitSlop={8}>
              <Feather name="edit-2" size={14} color={colors.muted} />
            </Pressable>
          )}
          <Pressable onPress={() => setShowSharePreview(true)} accessibilityLabel="Compartilhar avaliação" hitSlop={8}>
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

      {showSharePreview && (
        <SharePreviewSheet
          imageUrl={reviewShareImageUrl(review.id)}
          storyImageUrl={reviewStoryImageUrl(review.id)}
          shareUrl={reviewShareUrl(review.id)}
          onDismiss={() => setShowSharePreview(false)}
        />
      )}
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
