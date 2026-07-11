import type { Review } from "@/lib/queries/social/reviews";
import { StarRating } from "./StarRating";
import { SpoilerGate } from "./SpoilerGate";
import { LikeButton } from "./LikeButton";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

export function ReviewCard({ review }: { review: Review }) {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text">{review.author.displayName ?? review.author.username}</span>
          <span className="text-xs text-muted">{dateFormatter.format(new Date(review.createdAt))}</span>
        </div>
        <StarRating value={review.rating ?? 0} size="sm" />
      </div>
      {review.reviewText && (
        <SpoilerGate hidden={review.containsSpoiler}>
          <p className="text-sm text-text">{review.reviewText}</p>
        </SpoilerGate>
      )}
      <LikeButton targetType="review" targetId={review.id} />
    </div>
  );
}
