"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MediaTarget } from "@/lib/queries/social/types";
import { useReviews, useMyReview, useUpsertReview, useDeleteReview } from "@/lib/queries/social/reviews";
import { useLikeInfoBatch } from "@/lib/queries/social/likes";
import { useRealtimePublicInvalidate } from "@/lib/supabase/useRealtimePublicInvalidate";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { ReviewFullComposer } from "./ReviewFullComposer";
import { ReviewCard } from "./ReviewCard";
import { ReviewsSkeleton } from "./ReviewsSkeleton";
import { EmptyState } from "../search/EmptyState";

export interface ReviewTextSectionProps {
  target: MediaTarget;
  /** A PEDIDO (2026-10-08, "Compartilhamento social", Fase 1) — vindo do deep link de compartilhamento (`?highlight=`, mesmo parâmetro já usado por `CommentsSection`/`CommentItem` pra comentários, TASK-052). Rola até a review certa e destaca. */
  highlightReviewId?: string;
}

/**
 * A PEDIDO (revertendo uma decisão anterior — "não gostei, deixa
 * prático") — nota e texto voltaram a ser UM formulário só
 * (`ReviewFullComposer`), aqui dentro de "Ver todas as avaliações".
 * Antes: nota (estrelas) ficava sozinha na aba Sobre
 * (`ReviewsSection.tsx`) e o texto só liberava depois, aqui, criando
 * duas paradas pra uma avaliação só. A aba Sobre agora só mostra o
 * resumo da comunidade, sem nada pra preencher.
 */
export function ReviewTextSection({ target, highlightReviewId }: ReviewTextSectionProps) {
  const { data: reviews = [], isLoading } = useReviews(target);
  const { data: myReview } = useMyReview(target);
  const upsertReview = useUpsertReview(target);
  const deleteReview = useDeleteReview(target);
  const { t } = useTranslation();

  /**
   * BUG REAL CORRIGIDO (2026-10-08, reportado — "minha avaliação já
   * publicada aparece como se eu ainda estivesse digitando") — causa
   * raiz: a própria avaliação SEMPRE aparecia como formulário aberto
   * (`ReviewFullComposer`), mesmo já salva há dias, sem diferença
   * nenhuma entre "nunca escrevi" e "já publiquei". Corrigido: com
   * avaliação já existente, mostra fechada (`ReviewCard`, igual à de
   * qualquer outra pessoa — nome/estrelas/texto/like) com um botão
   * "Editar" que abre o formulário só quando a pessoa realmente quer
   * mudar algo. `isEditing` começa aberto (`true`) sem dado nenhum
   * ainda — melhor já-aberto do que um card vazio piscando — e só
   * muda sozinho quando `hasExistingReview` MUDA de valor (dado
   * chegou, ou avaliação removida), nunca durante edição em
   * andamento — mesmo padrão já usado no fix de sincronização dos
   * campos de nota/texto, acima no `ReviewFullComposer.tsx`.
   */
  const hasExistingReview = Boolean(myReview);
  const [isEditing, setIsEditing] = useState(!hasExistingReview);
  const prevHasExistingReviewRef = useRef(hasExistingReview);
  useEffect(() => {
    if (prevHasExistingReviewRef.current !== hasExistingReview) {
      setIsEditing(!hasExistingReview);
      prevHasExistingReviewRef.current = hasExistingReview;
    }
  }, [hasExistingReview]);

  const othersReviews = reviews.filter((r) => r.id !== myReview?.id);

  /** AUDITORIA (perf) — mesma correção de CommentsSection.tsx: 1 consulta pra todas as reviews visíveis, não uma por review. */
  const reviewIds = useMemo(() => othersReviews.map((r) => r.id), [othersReviews]);
  const { data: likeInfoByReviewId } = useLikeInfoBatch("review", reviewIds);
  // CORREÇÃO (mesmo achado de CommentsSection.tsx) — lote existia, inscrição de Realtime pra invalidar quando alguém curte, não.
  useRealtimePublicInvalidate(["likes"], ["like-info-batch"], { filter: "target_type=eq.review", exact: false });

  /**
   * BUG REAL CORRIGIDO (2026-08-27, reportado — "quando eu faço
   * avaliação, aparece esse erro" + print mostrando "Avaliação salva,
   * mas não foi possível publicar no Feed agora.") — causa raiz: a
   * caixa "Publicar também no Feed" foi escondida daqui há um tempo
   * (Feed descontinuado — ver comentário que ainda existia embaixo,
   * no JSX), mas só a CAIXA sumiu. O estado interno dela
   * (`ReviewFullComposer.tsx`, `shareToFeed`) continuava começando
   * em `true` toda primeira avaliação, sem nenhum jeito de desmarcar
   * (já que a caixa nem aparece mais) — então TODA avaliação nova
   * ainda disparava um envio pro Feed por baixo dos panos, que sempre
   * falhava (Feed descontinuado), gerando esse erro em 100% das
   * vezes. Corrigido pela raiz, não só escondendo de novo: a chamada
   * pro Feed foi removida completamente daqui (não só o gatilho —
   * o `usePublishReviewToFeed` nem é mais importado), e
   * `ReviewFullComposer.tsx` perdeu o parâmetro `shareToFeed`/a caixa
   * por completo (ver comentário lá). O hook em si
   * (`lib/queries/posts.ts`) e as tabelas do Feed continuam existindo
   * — só não são mais chamados a partir daqui, igual ao resto do
   * código do Feed (mantido, mas morto, por decisão já tomada antes).
   */
  function handleSubmit(rating: number, reviewText: string | null) {
    upsertReview.mutate({ rating, reviewText }, { onSuccess: () => setIsEditing(false) });
  }

  return (
    <div className="space-y-4">
      {isEditing || !myReview ? (
        <ReviewFullComposer
          initialRating={myReview?.rating ?? 0}
          initialText={myReview?.reviewText}
          hasExistingReview={hasExistingReview}
          isPending={upsertReview.isPending}
          isDeleting={deleteReview.isPending}
          onSubmit={handleSubmit}
          onDelete={() => myReview && deleteReview.mutate(myReview.id)}
          onCancel={hasExistingReview ? () => setIsEditing(false) : undefined}
        />
      ) : (
        <ReviewCard review={myReview} onEdit={() => setIsEditing(true)} />
      )}

      {isLoading ? (
        <ReviewsSkeleton />
      ) : othersReviews.length === 0 ? (
        <EmptyState message={t("social.emptyOtherReviews")} />
      ) : (
        <div className="space-y-3">
          {othersReviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              likeInfo={likeInfoByReviewId?.get(review.id)}
              isHighlighted={review.id === highlightReviewId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
