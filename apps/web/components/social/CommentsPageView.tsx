"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { MediaTarget } from "@/lib/queries/social/types";
import { CommentsSection } from "./CommentsSection";
import { PageContainer } from "../layout/PageContainer";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export interface CommentsPageViewProps {
  backHref: string;
  title: string;
  target: MediaTarget;
  /** A PEDIDO — repassado pra CommentsSection, pra mostrar a seção de review em texto (só faz sentido pra série/filme inteiro). */
  media?: { type: "movie" | "series"; title: string; posterPath: string | null };
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
export function CommentsPageView({ backHref, title, target, media }: CommentsPageViewProps) {
  const searchParams = useSearchParams();
  const highlightCommentId = searchParams.get("highlight") ?? undefined;
  const { t } = useTranslation();

  return (
    <div className="relative">
      {/* "Vidro" (redesign âmbar/vidro, 2026-08-26 — Comentários/Avaliações) — mesmo campo de manchas desfocadas de fundo do resto do app (ver ProfileView.tsx pro histórico de causa raiz: pintado primeiro, sem z-index negativo, fica atrás dos irmãos seguintes por ordem de DOM). */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute h-64 w-64 rounded-full opacity-45 blur-[60px]" style={{ top: "40px", left: "-22%", background: "#1B4B7A" }} />
        <div className="absolute h-60 w-60 rounded-full opacity-40 blur-[60px]" style={{ top: "320px", right: "-20%", background: "#2A7FB8" }} />
        <div className="absolute h-56 w-56 rounded-full opacity-35 blur-[60px]" style={{ top: "620px", left: "-18%", background: "#0D3B5C" }} />
      </div>

      <div className="relative flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <Link href={backHref} aria-label={t("common.back")} className="text-text">
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </Link>
        <h1 className="text-xl font-bold text-text">{title}</h1>
      </div>
      <PageContainer className="relative">
        <div className="py-4">
          <CommentsSection target={target} highlightCommentId={highlightCommentId} media={media} />
        </div>
      </PageContainer>
    </div>
  );
}
