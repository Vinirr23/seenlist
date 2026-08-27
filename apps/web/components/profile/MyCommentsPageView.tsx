"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useMyComments } from "@/lib/queries/my-comments";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { MyCommentRow } from "./MyCommentRow";
import { PageError } from "../media/PageError";

/**
 * TASK-056 — "todos os comentários publicados pelo usuário". Ao
 * tocar, abre exatamente o alvo certo (episódio/filme/série) — a URL
 * já vem pronta de useMyComments (targetUrl), reaproveitando as
 * rotas de comentários que já existiam (com ?highlight=, TASK-052).
 */
export function MyCommentsPageView() {
  const { data: comments, isLoading, isError, refetch } = useMyComments();
  const { t } = useTranslation();

  return (
    <div className="relative w-full pb-24 md:mx-auto md:max-w-[430px]">
      {/* "Vidro" (redesign âmbar/vidro, 2026-08-26 — Comentários/Avaliações) — mesmo campo de manchas desfocadas de fundo do resto do app. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute h-64 w-64 rounded-full opacity-45 blur-[60px]" style={{ top: "40px", left: "-22%", background: "#1B4B7A" }} />
        <div className="absolute h-60 w-60 rounded-full opacity-40 blur-[60px]" style={{ top: "320px", right: "-20%", background: "#2A7FB8" }} />
        <div className="absolute h-56 w-56 rounded-full opacity-35 blur-[60px]" style={{ top: "620px", left: "-18%", background: "#0D3B5C" }} />
      </div>

      <div className="relative flex items-center gap-3 px-4 pt-4">
        <Link href="/profile" aria-label={t("common.back")} className="text-text">
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </Link>
        <h1 className="text-xl font-bold text-text">{t("profile.comments")}</h1>
      </div>

      <div className="relative mt-4">
        {isLoading && (
          // Esqueleto de carregamento fica propositalmente `bg-surface` opaco (mesmo padrão já usado no resto do app — DiscoverCarousel.tsx etc.).
          <div className="space-y-2 px-4" aria-busy="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-surface" />
            ))}
          </div>
        )}

        {isError && <PageError message={t("profile.errorLoadComments")} onRetry={() => refetch()} />}

        {!isLoading && !isError && comments?.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-muted">{t("profile.emptyMyComments")}</p>
        )}

        {comments && comments.length > 0 && (
          <div className="space-y-2 px-4">
            {comments.map((comment) => (
              <MyCommentRow key={comment.id} comment={comment} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
