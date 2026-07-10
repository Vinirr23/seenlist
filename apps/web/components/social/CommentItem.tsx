"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import type { Comment } from "@/lib/queries/social/comments";
import { cn } from "@seenlist/utils";
import { SpoilerGate } from "./SpoilerGate";
import { LikeButton } from "./LikeButton";
import { CommentComposer } from "./CommentComposer";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

export interface CommentItemProps {
  comment: Comment;
  depth: number;
  currentUserId: string | undefined;
  onReply: (parentId: string, body: string, containsSpoiler: boolean) => void;
  onEdit: (commentId: string, body: string, containsSpoiler: boolean) => void;
  onDelete: (commentId: string) => void;
  isMutating: boolean;
  /** TASK-052 — vindo do deep link de notificação (?highlight=id). Rola até este comentário e destaca visualmente por alguns segundos. */
  isHighlighted?: boolean;
  children?: React.ReactNode;
}

/**
 * TASK-048 — "respostas até três níveis". Postgres não impõe limite
 * de profundidade sozinho (parent_comment_id é auto-referência livre)
 * — o limite é de UX, aplicado aqui: com depth 0/1/2 (3 níveis), o
 * botão "Responder" só aparece até depth 1 (responder ali gera
 * depth 2, o último nível permitido). Decisão deliberada, documentada
 * — não é uma constraint de banco pra não travar se um dia o limite
 * mudar de 3 pra outro número.
 */
export function CommentItem({
  comment,
  depth,
  currentUserId,
  onReply,
  onEdit,
  onDelete,
  isMutating,
  isHighlighted,
  children,
}: CommentItemProps) {
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isHighlighted) {
      containerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isHighlighted]);

  const isOwn = currentUserId != null && currentUserId === comment.author.userId;
  const canReply = depth < 2;

  if (editing) {
    return (
      <div className="rounded-lg border border-border bg-surface p-3">
        <CommentComposer
          initialBody={comment.body}
          initialSpoiler={comment.containsSpoiler}
          submitLabel="Salvar"
          isPending={isMutating}
          onCancel={() => setEditing(false)}
          onSubmit={(body, containsSpoiler) => {
            onEdit(comment.id, body, containsSpoiler);
            setEditing(false);
          }}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        depth === 0 ? "space-y-2 rounded-lg border border-border bg-surface p-3" : "space-y-2",
        isHighlighted && "ring-2 ring-primary"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="font-medium text-text">{comment.author.displayName ?? comment.author.username}</span>
            <span>{dateFormatter.format(new Date(comment.createdAt))}</span>
          </div>
          <div className="mt-1">
            <SpoilerGate hidden={comment.containsSpoiler}>
              <p className="text-sm text-text">{comment.body}</p>
            </SpoilerGate>
          </div>
          <div className="mt-1.5 flex items-center gap-3">
            <LikeButton targetType="comment" targetId={comment.id} />
            {canReply && (
              <button
                type="button"
                onClick={() => setReplying((v) => !v)}
                className="text-xs font-medium text-muted hover:text-text"
              >
                Responder
              </button>
            )}
          </div>
        </div>

        {isOwn && (
          <div className="relative shrink-0">
            <button type="button" onClick={() => setMenuOpen((v) => !v)} className="p-1 text-muted hover:text-text">
              <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-6 z-10 min-w-[120px] rounded-lg border border-border bg-surface py-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(true);
                    setMenuOpen(false);
                  }}
                  className="block w-full px-3 py-1.5 text-left text-xs text-text hover:bg-background"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDelete(comment.id);
                    setMenuOpen(false);
                  }}
                  className="block w-full px-3 py-1.5 text-left text-xs text-danger hover:bg-background"
                >
                  Excluir
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {replying && (
        <div className="ml-4 rounded-lg border border-border bg-background p-3">
          <CommentComposer
            placeholder="Escreva uma resposta..."
            submitLabel="Responder"
            isPending={isMutating}
            onCancel={() => setReplying(false)}
            onSubmit={(body, containsSpoiler) => {
              onReply(comment.id, body, containsSpoiler);
              setReplying(false);
            }}
          />
        </div>
      )}

      {/* TASK-050 — respostas ficam DENTRO da mesma janela do comentário pai: sem card/borda própria, só indentação + linha vertical, tudo contido no mesmo <div> com borda de fora (depth 0). */}
      {children && <div className="ml-4 space-y-3 border-l border-border pl-3">{children}</div>}
    </div>
  );
}
