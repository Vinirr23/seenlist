"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useMyComments } from "@/lib/queries/my-comments";
import { MyCommentRow } from "./MyCommentRow";

/**
 * TASK-056 — "todos os comentários publicados pelo usuário". Ao
 * tocar, abre exatamente o alvo certo (episódio/filme/série) — a URL
 * já vem pronta de useMyComments (targetUrl), reaproveitando as
 * rotas de comentários que já existiam (com ?highlight=, TASK-052).
 */
export function MyCommentsPageView() {
  const { data: comments, isLoading, isError } = useMyComments();

  return (
    <div className="w-full pb-24 md:mx-auto md:max-w-[430px]">
      <div className="flex items-center gap-3 px-4 pt-4">
        <Link href="/profile" aria-label="Voltar" className="text-text">
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </Link>
        <h1 className="text-lg font-bold text-text">Comentários</h1>
      </div>

      <div className="mt-4">
        {isLoading && (
          <div className="space-y-2 px-4" aria-busy="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-surface" />
            ))}
          </div>
        )}

        {isError && <p className="px-4 py-6 text-center text-sm text-muted">Não foi possível carregar seus comentários agora.</p>}

        {!isLoading && !isError && comments?.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-muted">Você ainda não fez nenhum comentário.</p>
        )}

        {comments?.map((comment) => (
          <MyCommentRow key={comment.id} comment={comment} />
        ))}
      </div>
    </div>
  );
}
