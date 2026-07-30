"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { useUserSearch } from "@/lib/queries/user-search";
import { useFollowStatusBatch } from "@/lib/queries/follow";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { UserListRow } from "./UserListRow";
import { PageError } from "../media/PageError";

/**
 * TASK-057 — tela de descoberta de usuários. Reaproveita UserListRow
 * inteiro (mesmo componente das telas Seguindo/Seguidores) — só a
 * fonte de dados muda (useUserSearch em vez de useFollowList).
 */
export function DiscoverUsersView() {
  const [search, setSearch] = useState("");
  const { data: users, isLoading, isError, refetch } = useUserSearch(search);
  const { t } = useTranslation();

  /** AUDITORIA (perf) — 1 consulta pra todos os usuários visíveis, não uma por linha. */
  const userIds = users?.map((u) => u.userId) ?? [];
  const { data: followingSet } = useFollowStatusBatch(userIds);

  return (
    <div className="w-full pb-24 md:mx-auto md:max-w-[430px]">
      <div className="flex items-center gap-3 px-4 pt-4">
        <Link href="/profile" aria-label={t("common.back")} className="text-text">
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </Link>
        <h1 className="text-lg font-bold text-text">{t("profile.discoverPeople")}</h1>
      </div>

      <div className="px-4 pt-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" strokeWidth={2} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("profile.searchPeople")}
            className="w-full rounded-lg border border-border bg-surface py-2.5 pl-9 pr-3 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      <div className="mt-2">
        {!search && !isLoading && users && users.length > 0 && (
          <p className="px-4 pb-1 text-xs font-medium uppercase tracking-wide text-muted">{t("profile.suggestions")}</p>
        )}

        {isLoading && (
          <div className="space-y-1 px-4 py-2" aria-busy="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-surface" />
            ))}
          </div>
        )}

        {isError && <PageError message={t("profile.errorLoadGeneric")} onRetry={() => refetch()} />}

        {!isLoading && !isError && users?.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-muted">{t("profile.noResultsForSearch")}</p>
        )}

        {users?.map((user) => (
          <UserListRow key={user.userId} user={user} isFollowing={followingSet?.has(user.userId)} />
        ))}
      </div>
    </div>
  );
}
