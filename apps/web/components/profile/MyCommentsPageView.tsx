"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useMyComments } from "@/lib/queries/my-comments";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { MyCommentRow } from "./MyCommentRow";

/**
 * TASK-056 — "todos os comentários publicados pelo usuário". Ao
 * tocar, abre exatamente o alvo certo (episódio/filme/série) — a URL
 * já vem pronta de useMyComments (targetUrl), reaproveitando as
 * rotas de comentários que já existiam (com ?highlight=, TASK-052).
 */
export function MyCommentsPageView() {
  const { data: comments, isLoading, isError } = useMyComments();
  const { t } = useTranslation();

  return (
    <div className="w-full pb-24 md:mx-auto md:max-w-[430px]">
      <div className="flex items-center gap-3 px-4 pt-4">
        <Link href="/profile" aria-label={t("common.back")} className="text-text">
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </Link>
        <h1 className="text-lg font-bold text-text">{t("profile.comments")}</h1>
      </div>

      <div className="mt-4">
        {isLoading && (
          <div className="space-y-2 px-4" aria-busy="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-surface" />
            ))}
          </div>
        )}

        {isError && <p className="px-4 py-6 text-center text-sm text-muted">{t("profile.errorLoadComments")}</p>}

        {!isLoading && !isError && comments?.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-muted">{t("profile.emptyMyComments")}</p>
        )}

        {comments?.map((comment) => (
          <MyCommentRow key={comment.id} comment={comment} />
        ))}
      </div>
    </div>
  );
}
