"use client";

import { useMemo } from "react";
import type { MediaTarget } from "@/lib/queries/social/types";
import { useComments, usePostComment, useEditComment, useDeleteComment, type Comment } from "@/lib/queries/social/comments";
import { useLikeInfoBatch } from "@/lib/queries/social/likes";
import { useSpoilerProtection } from "@/lib/queries/social/spoiler-protection";
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
  /** Só faz sentido quando o alvo é um episódio — usado pra oclusão automática por progresso (TASK-031). */
  episodeSpoilerContext?: { seriesId: number; seasonNumber: number; episodeNumber: number };
  /** TASK-052 — id do comentário vindo do deep link de notificação (?highlight=). */
  highlightCommentId?: string;
  /**
   * A PEDIDO — quando passado (só faz sentido pra série/filme
   * INTEIRO, nunca episódio), a tela mostra SÓ a review em texto
   * (minha + de outras pessoas), sem comentário comum — decisão
   * confirmada: "review e comentários" juntos no nível de
   * série/filme inteiro era redundante/confuso, comentário comum
   * agora só existe por episódio (`episodeSpoilerContext` presente).
   * Comentários antigos que já existiam nesse nível (antes desta
   * mudança) continuam no banco, só pararam de aparecer aqui.
   */
  media?: { type: "movie" | "series"; title: string; posterPath: string | null };
}

/**
 * TASK-048 — container único, reutilizado igual pra série, filme e
 * episódio (só muda o `target` passado por quem usa). A oclusão
 * automática por progresso (`useSpoilerProtection`) só entra quando
 * `episodeSpoilerContext` é passado — comentário de série/filme
 * inteiro continua usando só a flag manual.
 *
 * `media` presente = página de série/filme inteiro = só review em
 * texto, sem comentário comum (ver comentário no tipo `media` acima).
 * `media` ausente = página de episódio = comentário comum normal.
 */
export function CommentsSection({ target, episodeSpoilerContext, highlightCommentId, media }: CommentsSectionProps) {
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

  const spoilerProtection = useSpoilerProtection(
    episodeSpoilerContext?.seriesId ?? 0,
    episodeSpoilerContext?.seasonNumber ?? 0,
    episodeSpoilerContext?.episodeNumber ?? 0
  );
  const autoHide = Boolean(episodeSpoilerContext) && spoilerProtection.shouldHideByDefault;

  const tree = useMemo(() => buildTree(comments), [comments]);
  const isMutating = postComment.isPending || editComment.isPending || deleteComment.isPending;

  function renderNode(node: CommentNode, depth: number): React.ReactNode {
    const hidden = node.containsSpoiler || autoHide;
    return (
      <CommentItem
        key={node.id}
        comment={{ ...node, containsSpoiler: hidden }}
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
    return <ReviewTextSection target={target} media={media} />;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface p-3">
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
