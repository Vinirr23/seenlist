"use client";

import Link from "next/link";
import type { FollowListUser } from "@/lib/queries/follow-list";
import { FollowButton } from "@/components/social/FollowButton";

function initials(name: string): string {
  return name
    .split(" ")
    .filter((word) => word.length > 1)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export function UserListRow({ user }: { user: FollowListUser }) {
  const displayName = user.displayName || user.username;

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Link href={`/u/${user.username}`} className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatar externo, sem domínio fixo pra configurar em next/image
            <img src={user.avatarUrl} alt={displayName} className="h-full w-full object-cover" />
          ) : (
            <span className="text-sm font-semibold text-muted">{initials(displayName)}</span>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text">{displayName}</p>
          <p className="truncate text-xs text-muted">@{user.username}</p>
          {user.followsViewer && <p className="mt-0.5 text-xs text-primary">Segue você</p>}
        </div>
      </Link>
      <FollowButton targetUserId={user.userId} />
    </div>
  );
}
