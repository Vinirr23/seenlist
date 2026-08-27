"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search, UserPlus } from "lucide-react";
import { useFollowList } from "@/lib/queries/follow-list";
import { useFollowStatusBatch } from "@/lib/queries/follow";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { UserListRow } from "./UserListRow";
import { PageError } from "../media/PageError";

export interface UserListPageViewProps {
  userId: string;
  direction: "following" | "followers";
  title: string;
}

/**
 * TASK-056 — mesma tela pras duas rotas (/profile/following e
 * /profile/followers), só troca `direction`/`title`. Evita duplicar
 * header+busca+lista em dois arquivos quase idênticos.
 */
export function UserListPageView({ userId, direction, title }: UserListPageViewProps) {
  const [search, setSearch] = useState("");
  const { data: users, isLoading, isError, refetch } = useFollowList(userId, direction, search);
  const { t } = useTranslation();

  /**
   * AUDITORIA (perf) — só busca em lote na tela de Seguidores: na de
   * Seguindo, "eu sigo esta pessoa" já é sempre verdadeiro pra todo
   * mundo da lista (é literalmente a definição da lista), então uma
   * consulta a mais aqui só desperdiçaria uma chamada de rede.
   */
  const userIds = direction === "followers" ? (users?.map((u) => u.userId) ?? []) : [];
  const { data: followingSet } = useFollowStatusBatch(userIds);

  return (
    <div className="relative w-full pb-24 md:mx-auto md:max-w-[430px]">
      {/* "Vidro" (redesign âmbar/vidro, 2026-08-26 — Seguidores/Seguindo) — mesmo campo de manchas desfocadas de fundo do resto do app (Perfil/Explorar/Comentários/Listas). */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute h-64 w-64 rounded-full opacity-45 blur-[60px]" style={{ top: "40px", left: "-22%", background: "#1B4B7A" }} />
        <div className="absolute h-60 w-60 rounded-full opacity-40 blur-[60px]" style={{ top: "320px", right: "-20%", background: "#2A7FB8" }} />
        <div className="absolute h-56 w-56 rounded-full opacity-35 blur-[60px]" style={{ top: "620px", left: "-18%", background: "#0D3B5C" }} />
      </div>

      <div className="relative flex items-center gap-3 px-4 pt-4">
        <Link href="/profile" aria-label={t("common.back")} className="text-text">
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </Link>
        <h1 className="flex-1 text-xl font-bold text-text">{title}</h1>
        <Link href="/profile/discover-people" aria-label={t("profile.discoverPeople")} className="text-text">
          <UserPlus className="h-5 w-5" strokeWidth={2} />
        </Link>
      </div>

      <div className="relative px-4 pt-4">
        {/* "Vidro" (mesmo padrão do campo de busca do SearchBar.tsx) — borda clara + blur/saturação + gradiente radial translúcido, em vez de `border-border bg-surface` opaco. O campo de texto em si continua transparente por dentro (campos de formulário não recebem vidro). */}
        <div
          className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2.5 backdrop-blur-[18px] backdrop-saturate-[180%]"
          style={{
            background: "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.17), transparent 60%), rgba(255,255,255,0.10)",
          }}
        >
          <Search className="h-4 w-4 shrink-0 text-muted" strokeWidth={2} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("common.search")}
            className="w-full bg-transparent text-sm text-text placeholder:text-muted focus:outline-none"
          />
        </div>
      </div>

      <div className="relative mt-2 space-y-2 px-4">
        {isLoading && (
          <div className="space-y-2" aria-busy="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface" />
            ))}
          </div>
        )}

        {isError && <PageError message={t("profile.errorLoadGeneric")} onRetry={() => refetch()} />}

        {!isLoading && !isError && users?.length === 0 && (
          <p className="py-6 text-center text-sm text-muted">
            {search
              ? t("profile.noResultsForSearch")
              : direction === "following"
                ? t("profile.emptyFollowing")
                : t("profile.emptyFollowers")}
          </p>
        )}

        {users?.map((user) => (
          <UserListRow key={user.userId} user={user} isFollowing={direction === "following" ? true : followingSet?.has(user.userId)} />
        ))}
      </div>
    </div>
  );
}
