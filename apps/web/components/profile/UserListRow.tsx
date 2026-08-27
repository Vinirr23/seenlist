"use client";

import Link from "next/link";
import type { FollowListUser } from "@/lib/queries/follow-list";
import { FollowButton } from "@/components/social/FollowButton";
import { Avatar } from "@/components/common/Avatar";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export function UserListRow({ user, isFollowing }: { user: FollowListUser; isFollowing?: boolean }) {
  const displayName = user.displayName || user.username;
  const { t } = useTranslation();

  return (
    // "Vidro" (mesmo padrão de ExploreActivityTab.tsx) — "glass-row", em vez de uma linha lisa sem borda/fundo nenhum.
    <div
      className="flex items-center gap-3 rounded-2xl border border-white/10 px-3.5 py-3 backdrop-blur-[18px] backdrop-saturate-[180%]"
      style={{
        background: "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.17), transparent 60%), rgba(255,255,255,0.10)",
      }}
    >
      <Link href={`/u/${user.username}`} className="flex min-w-0 flex-1 items-center gap-3">
        {/* BUG REAL CORRIGIDO (2026-08-27, ver comentário completo em `components/common/Avatar.tsx`) — antes, foto quebrada (link existe mas falha ao carregar) ficava com o ícone padrão do navegador pra sempre; `Avatar` cai pras iniciais nesse caso. */}
        <Avatar src={user.avatarUrl} name={displayName} className="h-11 w-11 bg-surface" textClassName="text-sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text">{displayName}</p>
          <p className="truncate text-xs text-muted">@{user.username}</p>
          {user.followsViewer && <p className="mt-0.5 text-xs text-primary">{t("profile.followsYou")}</p>}
        </div>
      </Link>
      <FollowButton targetUserId={user.userId} initial={isFollowing} />
    </div>
  );
}
