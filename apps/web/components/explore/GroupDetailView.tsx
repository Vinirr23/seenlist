"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Users, MessageSquare, AlertTriangle, Heart } from "lucide-react";
import { getMockGroup, getMockPosts } from "@/lib/mock-groups";
import { SpoilerGate } from "@/components/social/SpoilerGate";

const numberFormatter = new Intl.NumberFormat("pt-BR");
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

/**
 * TASK-058 — "não implementar funcionalidades sociais completas.
 * Apenas a estrutura visual." Entrar/curtir aqui são só estado local
 * (useState), não gravam nada no banco — igual pediu.
 */
export function GroupDetailView({ slug }: { slug: string }) {
  const group = getMockGroup(slug);
  const posts = getMockPosts(slug);
  const [joined, setJoined] = useState(false);

  if (!group) {
    return (
      <div className="px-4 pt-6 text-center text-sm text-muted">
        Grupo não encontrado.{" "}
        <Link href="/explore" className="text-primary underline">
          Voltar
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full pb-24 md:mx-auto md:max-w-[430px]">
      <div className="relative h-40 w-full">
        <Image src={group.coverUrl} alt="" fill sizes="430px" className="object-cover" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <Link
          href="/explore"
          aria-label="Voltar"
          className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-background/70 text-text backdrop-blur"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.25} />
        </Link>
        <h1 className="absolute bottom-3 left-4 text-xl font-bold text-white drop-shadow">{group.name}</h1>
      </div>

      <div className="px-4 pt-4">
        <p className="text-sm text-muted">{group.description}</p>

        <div className="mt-3 flex items-center gap-4">
          <button
            type="button"
            onClick={() => setJoined((v) => !v)}
            className={
              joined
                ? "rounded-lg border border-border px-5 py-2 text-sm font-semibold text-text"
                : "rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-background"
            }
          >
            {joined ? "Participando" : "Entrar"}
          </button>
          <span className="flex items-center gap-1 text-xs text-muted">
            <Users className="h-3.5 w-3.5" strokeWidth={2} />
            {numberFormatter.format(group.members)}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted">
            <MessageSquare className="h-3.5 w-3.5" strokeWidth={2} />
            {numberFormatter.format(group.posts)}
          </span>
        </div>

        {group.hasSpoilers && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-primary/10 px-3 py-2.5 text-xs text-primary">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
            Spoilers a seguir! Este grupo discute todos os títulos relacionados e pode conter spoilers.
          </div>
        )}
      </div>

      <div className="mt-4 space-y-3 px-4">
        {posts.map((post) => (
          <div key={post.id} className="rounded-xl border border-border bg-surface p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-text">{post.authorName}</p>
              <p className="text-xs text-muted">{dateFormatter.format(new Date(post.createdAt))}</p>
            </div>
            <SpoilerGate hidden={post.containsSpoiler}>
              <p className="text-sm text-text">{post.body}</p>
            </SpoilerGate>
            <div className="mt-2 flex items-center gap-4 text-xs text-muted">
              <span className="flex items-center gap-1">
                <Heart className="h-3.5 w-3.5" strokeWidth={2} />
                {post.likes}
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5" strokeWidth={2} />
                {post.comments}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
