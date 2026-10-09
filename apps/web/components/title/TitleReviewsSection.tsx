import { Star } from "lucide-react";
import { Avatar } from "@/components/common/Avatar";
import { VerifiedBadge } from "@/components/common/VerifiedBadge";
import { SpoilerGate } from "@/components/social/SpoilerGate";
import type { TitleCommunityAggregate, TitleCommunityReview } from "@/lib/server/titlePublicContent";

/**
 * A PEDIDO (2026-10-09 — SEO Fase 2). NÃO é `ReviewsSection.tsx`/
 * `ReviewCard.tsx` reaproveitados — aqueles dois dependem de hooks que
 * exigem sessão (`useReviews`/`useMyReview`, `LikeButton` com mutation,
 * `ReviewCard`'s `onEdit`/compartilhar) e buscam os dados no cliente.
 * Aqui os dados já chegam como prop, buscados no servidor por
 * `fetchTitleCommunityContent` — só leitura, sem nenhuma ação que
 * precise de login (curtir, editar, denunciar). Mesmo visual de
 * "vidro" dos cards do resto do app, versão somente-exibição.
 *
 * Componente de SERVIDOR — `SpoilerGate` (o único filho "use client"
 * aqui) ainda funciona normalmente dentro de uma árvore renderizada no
 * servidor, só hidrata a parte dele.
 */
function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
}

function AggregateSummary({ aggregate }: { aggregate: TitleCommunityAggregate }) {
  return (
    <div className="mb-3 flex items-center gap-2 text-sm text-text">
      <Star className="h-4 w-4 fill-primary text-primary" strokeWidth={0} />
      <span className="font-semibold">{aggregate.average.toFixed(1)}</span>
      <span className="text-muted">
        · {aggregate.count} {aggregate.count === 1 ? "avaliação" : "avaliações"} da comunidade SeenList
      </span>
    </div>
  );
}

export function TitleReviewsSection({
  reviews,
  aggregate,
}: {
  reviews: TitleCommunityReview[];
  aggregate: TitleCommunityAggregate | null;
}) {
  if (reviews.length === 0) return null;

  return (
    <section>
      <h2 className="mb-2 text-sm font-medium text-text">Avaliações da comunidade</h2>
      {aggregate && <AggregateSummary aggregate={aggregate} />}
      <div className="space-y-2">
        {reviews.map((review) => {
          const authorName = review.author.displayName;
          return (
            <div
              key={review.id}
              className="space-y-2 rounded-2xl border border-white/10 p-3.5 backdrop-blur-[18px] backdrop-saturate-[180%]"
              style={{
                background:
                  "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.17), transparent 60%), rgba(255,255,255,0.10)",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar src={review.author.avatarUrl} name={authorName} className="h-6 w-6 bg-surface" textClassName="text-[10px]" />
                  <span className="truncate text-sm font-medium text-text">{authorName}</span>
                  <VerifiedBadge tier={review.author.verifiedTier} />
                  <span className="shrink-0 text-xs text-muted">{formatDate(review.createdAt)}</span>
                </div>
                {review.rating !== null && (
                  <div className="flex shrink-0 items-center gap-1 text-xs text-primary">
                    <Star className="h-3.5 w-3.5 fill-primary" strokeWidth={0} />
                    {review.rating.toFixed(1)}
                  </div>
                )}
              </div>
              {review.reviewText && (
                <SpoilerGate hidden={review.containsSpoiler}>
                  <p className="text-sm text-text">{review.reviewText}</p>
                </SpoilerGate>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
