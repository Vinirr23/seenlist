"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { usePost } from "@/lib/queries/posts";
import { PostCard } from "./PostCard";

export function PostDetailView({ postId }: { postId: string }) {
  const { data: post, isLoading, isError } = usePost(postId);

  return (
    <div className="w-full pb-24 md:mx-auto md:max-w-[430px]">
      <div className="flex items-center gap-3 px-4 pt-4">
        <Link href="/explore" aria-label="Voltar" className="text-text">
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </Link>
        <h1 className="text-lg font-bold text-text">Post</h1>
      </div>

      <div className="px-4 pt-4">
        {isLoading && <div className="h-32 animate-pulse rounded-xl bg-surface" />}
        {isError && <p className="text-center text-sm text-muted">Não foi possível carregar este post.</p>}
        {!isLoading && !isError && !post && <p className="text-center text-sm text-muted">Este post não existe mais.</p>}
        {post && <PostCard post={post} />}
      </div>
    </div>
  );
}
