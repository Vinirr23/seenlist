"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { MediaTarget } from "@/lib/queries/social/types";
import { CommentsSection } from "./CommentsSection";
import { PageContainer } from "../layout/PageContainer";

export interface CommentsPageViewProps {
  backHref: string;
  title: string;
  target: MediaTarget;
  episodeSpoilerContext?: { seriesId: number; seasonNumber: number; episodeNumber: number };
}

/**
 * TASK-049 — "quero que comentários seja um botão, e abra outra
 * tela". Um layout só, reutilizado pelas 3 rotas
 * (/series/[id]/comments, /movies/[id]/comments,
 * /series/[id]/season/[s]/episode/[e]/comments) — cada page.tsx só
 * passa `backHref`/`title`/`target` diferentes.
 *
 * TASK-052 — `?highlight=<id>` (vindo do deep link de notificação de
 * resposta/curtida) rola até o comentário certo e destaca ele.
 */
export function CommentsPageView({ backHref, title, target, episodeSpoilerContext }: CommentsPageViewProps) {
  const searchParams = useSearchParams();
  const highlightCommentId = searchParams.get("highlight") ?? undefined;

  return (
    <div>
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Link href={backHref} aria-label="Voltar" className="text-text">
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </Link>
        <h1 className="text-base font-semibold text-text">{title}</h1>
      </div>
      <PageContainer>
        <div className="py-4">
          <CommentsSection target={target} episodeSpoilerContext={episodeSpoilerContext} highlightCommentId={highlightCommentId} />
        </div>
      </PageContainer>
    </div>
  );
}
