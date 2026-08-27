import Link from "next/link";
import type { Review } from "@/lib/queries/social/reviews";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { INTL_LOCALES } from "@/lib/i18n/translations";
import { Avatar } from "@/components/common/Avatar";
import { StarRating } from "./StarRating";
import { SpoilerGate } from "./SpoilerGate";
import { LikeButton } from "./LikeButton";

/**
 * BUG REAL CORRIGIDO (2026-08-27, reportado — "quando aperto sobre o
 * nome do usuário, não entra no perfil dele, nem aparece a foto do
 * perfil") — causa raiz: o nome do autor aqui sempre foi só um
 * `<span>` de texto puro, sem nenhum `Link` nem avatar — nunca teve
 * esse comportamento, não é uma regressão desta sessão. Corrigido
 * replicando o mesmo padrão já usado em `UserListRow.tsx`
 * (Seguidores/Seguindo): avatar (ou iniciais) + nome dentro de um
 * `Link` pra `/u/[username]`. O mesmo bug existia em `CommentItem.tsx`
 * (comentários) — corrigido junto, mesma receita, por ser o mesmo
 * padrão reutilizado (regra "tudo deve ser padronizado").
 */
export function ReviewCard({ review, likeInfo }: { review: Review; likeInfo?: { count: number; hasLiked: boolean } }) {
  const { locale } = useTranslation();
  const dateFormatter = new Intl.DateTimeFormat(INTL_LOCALES[locale], { day: "2-digit", month: "short" });
  const authorName = review.author.displayName ?? review.author.username;

  return (
    // "Vidro" (redesign âmbar/vidro, 2026-08-26 — Comentários/Avaliações) — mesma textura de card neutro do resto do app.
    <div
      className="space-y-2 rounded-2xl border border-white/10 p-3.5 backdrop-blur-[18px] backdrop-saturate-[180%]"
      style={{
        background: "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.17), transparent 60%), rgba(255,255,255,0.10)",
      }}
    >
      <div className="flex items-center justify-between">
        <Link href={`/u/${review.author.username}`} className="flex min-w-0 items-center gap-2">
          {/* BUG REAL CORRIGIDO (2026-08-27, ver comentário completo em `components/common/Avatar.tsx`) — foto quebrada agora cai pras iniciais. */}
          <Avatar src={review.author.avatarUrl} name={authorName} className="h-6 w-6 bg-surface" textClassName="text-[10px]" />
          <span className="truncate text-sm font-medium text-text">{authorName}</span>
          <span className="shrink-0 text-xs text-muted">{dateFormatter.format(new Date(review.createdAt))}</span>
        </Link>
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
