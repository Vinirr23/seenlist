"use client";

import { useMemo } from "react";
import type { MediaTarget } from "@/lib/queries/social/types";
import { useComments, usePostComment, useEditComment, useDeleteComment, type Comment } from "@/lib/queries/social/comments";
import { useLikeInfoBatch } from "@/lib/queries/social/likes";
import { useRealtimePublicInvalidate } from "@/lib/supabase/useRealtimePublicInvalidate";
import { useCurrentUser } from "@/lib/queries/current-user";
import { CommentItem } from "./CommentItem";
import { CommentComposer } from "./CommentComposer";
import { CommentsSkeleton } from "./CommentsSkeleton";
import { ReviewTextSection } from "./ReviewTextSection";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { EmptyState } from "../search/EmptyState";

interface CommentNode extends Comment {
  children: CommentNode[];
}

function buildTree(comments: Comment[]): CommentNode[] {
  const byId = new Map<string, CommentNode>();
  for (const comment of comments) byId.set(comment.id, { ...comment, children: [] });

  const roots: CommentNode[] = [];
  for (const comment of comments) {
    const node = byId.get(comment.id) as CommentNode;
    if (comment.parentCommentId && byId.has(comment.parentCommentId)) {
      byId.get(comment.parentCommentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export interface CommentsSectionProps {
  target: MediaTarget;
  /** TASK-052 — id do comentário vindo do deep link de notificação (?highlight=). */
  highlightCommentId?: string;
  /**
   * A PEDIDO — quando passado (só faz sentido pra série/filme
   * INTEIRO, nunca episódio), a tela mostra SÓ a review em texto
   * (minha + de outras pessoas), sem comentário comum — decisão
   * confirmada: "review e comentários" juntos no nível de
   * série/filme inteiro era redundante/confuso, comentário comum
   * agora só existe por episódio. Comentários antigos que já
   * existiam nesse nível (antes desta mudança) continuam no banco,
   * só pararam de aparecer aqui.
   */
  media?: { type: "movie" | "series"; title: string; posterPath: string | null };
}

/**
 * TASK-048 — container único, reutilizado igual pra série, filme e
 * episódio (só muda o `target` passado por quem usa).
 *
 * `media` presente = página de série/filme inteiro = só review em
 * texto, sem comentário comum (ver comentário no tipo `media` acima).
 * `media` ausente = página de episódio = comentário comum normal.
 *
 * CORREÇÃO (a pedido — "não gostei, quero um aviso antes de entrar")
 * — a oclusão automática por progresso (`episodeSpoilerContext` +
 * `useSpoilerProtection`, TASK-031) saiu daqui. Antes, cada
 * comentário de quem ainda não tinha assistido o episódio aparecia
 * escondido individualmente dizendo "contém spoiler" (mesmo sem ser
 * spoiler de verdade — bug real corrigido antes disso). Agora o
 * aviso é ÚNICO, ANTES de entrar nessa tela, em
 * `EpisodeDetailView.tsx` (o botão "Comentário" pergunta antes de
 * navegar) — aqui dentro, só o `containsSpoiler` MANUAL de cada
 * comentário (marcado por quem escreveu) continua escondendo.
 */
export function CommentsSection({ target, highlightCommentId, media }: CommentsSectionProps) {
  // Não busca comentário comum quando é página de série/filme inteiro
  // (não tem por onde aparecer na tela) — evita consulta de rede à toa.
  const { data: comments = [], isLoading } = useComments(target, { enabled: !media });
  const { data: currentUser } = useCurrentUser();
  const postComment = usePostComment(target);
  const editComment = useEditComment(target);
  const deleteComment = useDeleteComment(target);
  const { t } = useTranslation();

  /**
   * AUDITORIA (perf) — 1 consulta pra todos os comentários visíveis,
   * não uma por comentário. Antes: `LikeButton` (dentro de cada
   * `CommentItem`) buscava sozinho, sem nenhum lote — com N
   * comentários na tela, N×2 consultas de rede, cada uma com sua
   * própria checagem de usuário. Mesma correção já aplicada ao Feed
   * (`useLikeInfoBatch`, TASK-153) e ao app mobile, nunca portada
   * pra comentários do web.
   */
  const commentIds = useMemo(() => comments.map((c) => c.id), [comments]);
  const { data: likeInfoByCommentId } = useLikeInfoBatch("comment", commentIds);
  /*
   * CORREÇÃO (achado real, auditoria — "curtida de comentário não
   * atualiza sozinha") — o comentário acima já registrava que essa
   * mesma correção tinha sido feita no Feed e no mobile, mas nunca
   * chegou até aqui: a busca em lote existia, a INSCRIÇÃO de
   * Realtime que invalida esse lote quando ALGUÉM curte, não. Mesmo
   * padrão exato do Feed (`ExploreFeedTab.tsx`).
   */
  useRealtimePublicInvalidate(["likes"], ["like-info-batch"], { filter: "target_type=eq.comment", exact: false });

  const tree = useMemo(() => buildTree(comments), [comments]);
  const isMutating = postComment.isPending || editComment.isPending || deleteComment.isPending;

  function renderNode(node: CommentNode, depth: number): React.ReactNode {
    return (
      <CommentItem
        key={node.id}
        comment={node}
        depth={depth}
        currentUserId={currentUser?.id}
        isMutating={isMutating}
        isHighlighted={node.id === highlightCommentId}
        likeInfo={likeInfoByCommentId?.get(node.id)}
        onReply={(parentId, body, containsSpoiler, imageUrl) =>
          postComment.mutate({ body, parentCommentId: parentId, containsSpoiler, imageUrl })
        }
        onEdit={(commentId, body, containsSpoiler, imageUrl) =>
          editComment.mutate({ commentId, body, containsSpoiler, imageUrl })
        }
        onDelete={(commentId) => deleteComment.mutate(commentId)}
      >
        {node.children.length > 0 && node.children.map((child) => renderNode(child, depth + 1))}
      </CommentItem>
    );
  }

  // Série/filme inteiro: só review em texto, sem comentário comum (ver docstring do componente).
  if (media) {
    // `media` só decide qual seção mostrar aqui — `ReviewTextSection` não
    // usa mais o valor em si (ver comentário do bug corrigido lá).
    return <ReviewTextSection target={target} />;
  }

  return (
    <div className="space-y-4">
      {/* "Vidro" (redesign âmbar/vidro, 2026-08-26 — Comentários/Avaliações) — mesma textura de card neutro já usada em MetaRow.tsx/ReviewSummary.tsx, em vez de `bg-surface` opaco. */}
      <div
        className="rounded-2xl border border-white/10 p-3.5 backdrop-blur-[18px] backdrop-saturate-[180%]"
        style={{
          background: "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.17), transparent 60%), rgba(255,255,255,0.10)",
        }}
      >
        <CommentComposer
          onSubmit={(body, containsSpoiler, imageUrl) => postComment.mutate({ body, containsSpoiler, imageUrl })}
          isPending={postComment.isPending}
        />
      </div>

      {isLoading ? (
        <CommentsSkeleton />
      ) : tree.length === 0 ? (
        <EmptyState message={t("social.emptyComments")} />
      ) : (
        <div className="space-y-4">{tree.map((node) => renderNode(node, 0))}</div>
      )}
    </div>
  );
}
