import type { Review } from "@/lib/queries/social/reviews";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { INTL_LOCALES } from "@/lib/i18n/translations";
import { StarRating } from "./StarRating";
import { SpoilerGate } from "./SpoilerGate";
import { LikeButton } from "./LikeButton";

export function ReviewCard({ review, likeInfo }: { review: Review; likeInfo?: { count: number; hasLiked: boolean } }) {
  const { locale } = useTranslation();
  const dateFormatter = new Intl.DateTimeFormat(INTL_LOCALES[locale], { day: "2-digit", month: "short" });

  return (
    // "Vidro" (redesign âmbar/vidro, 2026-08-26 — Comentários/Avaliações) — mesma textura de card neutro do resto do app.
    <div
      className="space-y-2 rounded-2xl border border-white/10 p-3.5 backdrop-blur-[18px] backdrop-saturate-[180%]"
      style={{
        background: "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.17), transparent 60%), rgba(255,255,255,0.10)",
      }}
    >
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
      <LikeButton targetType="review" targetId={review.id} initial={likeInfo} />
    </div>
  );
}
