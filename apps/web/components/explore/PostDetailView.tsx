"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { usePost } from "@/lib/queries/posts";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { PostCard } from "./PostCard";
import { PageError } from "../media/PageError";

/** TASK-073 — `detail` faz o card não navegar pra ele mesmo e mostrar os comentários sempre abertos, rolando a tela pra baixo. */
export function PostDetailView({ postId }: { postId: string }) {
  const { data: post, isLoading, isError, refetch } = usePost(postId);
  const { t } = useTranslation();

  return (
    <div className="w-full pb-24 md:mx-auto md:max-w-[430px]">
      <div className="flex items-center gap-3 px-4 pt-4">
        <Link href="/feed" aria-label={t("common.back")} className="text-text">
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </Link>
        <h1 className="text-lg font-bold text-text">{t("feed.post")}</h1>
      </div>

      <div className="px-4 pt-4">
        {isLoading && <div className="h-32 animate-pulse rounded-xl bg-surface" />}
        {isError && <PageError message={t("feed.errorLoadPost")} onRetry={() => refetch()} />}
        {!isLoading && !isError && !post && <p className="text-center text-sm text-muted">{t("feed.postNoLongerExists")}</p>}
        {post && <PostCard post={post} detail />}
      </div>
    </div>
  );
}
