"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search, UserPlus } from "lucide-react";
import { useFollowList } from "@/lib/queries/follow-list";
import { UserListRow } from "./UserListRow";

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
  const { data: users, isLoading, isError } = useFollowList(userId, direction, search);

  return (
    <div className="w-full pb-24 md:mx-auto md:max-w-[430px]">
      <div className="flex items-center gap-3 px-4 pt-4">
        <Link href="/profile" aria-label="Voltar" className="text-text">
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </Link>
        <h1 className="flex-1 text-lg font-bold text-text">{title}</h1>
        <Link href="/profile/discover-people" aria-label="Descobrir pessoas" className="text-text">
          <UserPlus className="h-5 w-5" strokeWidth={2} />
        </Link>
      </div>

      <div className="px-4 pt-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" strokeWidth={2} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar"
            className="w-full rounded-lg border border-border bg-surface py-2.5 pl-9 pr-3 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      <div className="mt-2">
        {isLoading && (
          <div className="space-y-1 px-4 py-2" aria-busy="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-surface" />
            ))}
          </div>
        )}

        {isError && <p className="px-4 py-6 text-center text-sm text-muted">Não foi possível carregar agora.</p>}

        {!isLoading && !isError && users?.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-muted">
            {search
              ? "Nenhum resultado pra essa busca."
              : direction === "following"
                ? "Ainda não segue ninguém."
                : "Ainda não tem seguidores."}
          </p>
        )}

        {users?.map((user) => (
          <UserListRow key={user.userId} user={user} />
        ))}
      </div>
    </div>
  );
}
