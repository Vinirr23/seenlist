"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Share2, Pencil } from "lucide-react";
import type { Review } from "@/lib/queries/social/reviews";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { INTL_LOCALES } from "@/lib/i18n/translations";
import { Avatar } from "@/components/common/Avatar";
import { VerifiedBadge } from "@/components/common/VerifiedBadge";
import { StarRating } from "./StarRating";
import { SpoilerGate } from "./SpoilerGate";
import { LikeButton } from "./LikeButton";
import { SharePreviewSheet } from "./SharePreviewSheet";

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
 *
 * A PEDIDO (2026-10-08, "Compartilhamento social", Fase 1):
 * - Botão de compartilhar permanente.
 * - `isHighlighted` — mesmo padrão de `CommentItem.tsx` (TASK-052):
 *   quando a review é a que veio de um link de compartilhamento
 *   (`?highlight=`), rola até ela e destaca com um anel, por alguns
 *   segundos.
 *
 * A PEDIDO (2026-10-08, reportado — "minha avaliação já publicada
 * aparece como se eu ainda estivesse digitando") — `onEdit`, opcional:
 * quando passado (só por `ReviewTextSection.tsx`, pra MOSTRAR a
 * própria avaliação), aparece um botão de lápis que abre o formulário
 * de edição. Review de outra pessoa nunca recebe essa prop.
 *
 * A PEDIDO (2026-10-08, extensão depois de testar no Threads —
 * "quero uma interface de pré-visualização antes de compartilhar"):
 * `handleShare` não copia mais o link direto pro clipboard — abre o
 * `SharePreviewSheet` mostrando o card visual gerado por
 * `opengraph-image.tsx` (mesma imagem que aparece na prévia do
 * Threads/WhatsApp), com botão de compartilhar/copiar link ali dentro.
 */
export function ReviewCard({
  review,
  likeInfo,
  isHighlighted,
  onEdit,
}: {
  review: Review;
  likeInfo?: { count: number; hasLiked: boolean };
  isHighlighted?: boolean;
  onEdit?: () => void;
}) {
  const { locale, t } = useTranslation();
  const dateFormatter = new Intl.DateTimeFormat(INTL_LOCALES[locale], { day: "2-digit", month: "short" });
  const authorName = review.author.displayName ?? review.author.username;
  const containerRef = useRef<HTMLDivElement>(null);
  const [showSharePreview, setShowSharePreview] = useState(false);

  useEffect(() => {
    if (isHighlighted) {
      containerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isHighlighted]);

  function handleShare() {
    setShowSharePreview(true);
  }

  return (
    <>
      {/* "Vidro" (redesign âmbar/vidro, 2026-08-26 — Comentários/Avaliações) — mesma textura de card neutro do resto do app. */}
      <div
        ref={containerRef}
        className={`space-y-2 rounded-2xl border border-white/10 p-3.5 backdrop-blur-[18px] backdrop-saturate-[180%] ${isHighlighted ? "ring-2 ring-primary" : ""}`}
        style={{
          background: "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.17), transparent 60%), rgba(255,255,255,0.10)",
        }}
      >
        <div className="flex items-center justify-between">
          <Link href={`/u/${review.author.username}`} className="flex min-w-0 items-center gap-2">
            {/* BUG REAL CORRIGIDO (2026-08-27, ver comentário completo em `components/common/Avatar.tsx`) — foto quebrada agora cai pras iniciais. */}
            <Avatar src={review.author.avatarUrl} name={authorName} className="h-6 w-6 bg-surface" textClassName="text-[10px]" />
            <span className="truncate text-sm font-medium text-text">{authorName}</span>
            <VerifiedBadge tier={review.author.verifiedTier} />
            <span className="shrink-0 text-xs text-muted">{dateFormatter.format(new Date(review.createdAt))}</span>
          </Link>
          <div className="flex shrink-0 items-center gap-2.5">
            <StarRating value={review.rating ?? 0} size="sm" />
            {onEdit && (
              <button type="button" onClick={onEdit} aria-label={t("social.editReview")} className="text-muted transition-transform active:scale-90">
                <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            )}
            <button type="button" onClick={handleShare} aria-label={t("social.shareReview")} className="text-muted transition-transform active:scale-90">
              <Share2 className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
        </div>
        {review.reviewText && (
          <SpoilerGate hidden={review.containsSpoiler}>
            <p className="text-sm text-text">{review.reviewText}</p>
          </SpoilerGate>
        )}
        <LikeButton targetType="review" targetId={review.id} initial={likeInfo} />
      </div>
      {showSharePreview && (
        <SharePreviewSheet
          imageUrl={`${window.location.origin}/r/${review.id}/opengraph-image`}
          shareUrl={`${window.location.origin}/r/${review.id}`}
          onClose={() => setShowSharePreview(false)}
        />
      )}
    </>
  );
}
