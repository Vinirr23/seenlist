import { View, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import type { Review } from "@/lib/social/reviews";
import { Text } from "@/components/ui";
import { StarRating } from "./StarRating";
import { SpoilerGate } from "./SpoilerGate";
import { LikeButton } from "@/components/feed/LikeButton";
import { colors, radius, spacing } from "@/lib/theme";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

export function ReviewCard({ review, initial }: { review: Review; initial?: { count: number; hasLiked: boolean } }) {
  const router = useRouter();

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Pressable style={styles.authorRow} onPress={() => router.push(`/u/${review.author.username}`)}>
          <Text style={styles.authorName}>{review.author.displayName ?? review.author.username}</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
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
  authorName: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
  },
  date: {
    fontSize: 11,
  },
  text: {
    fontSize: 13,
    color: colors.text,
  },
});
