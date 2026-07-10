"use client";

import { useState } from "react";
import { useFollowStatus, useToggleFollow } from "@/lib/queries/follow";
import { useToast } from "@/lib/toast/ToastProvider";
import { hapticTick } from "@/lib/haptics";

export function FollowButton({ targetUserId }: { targetUserId: string }) {
  const { data: isFollowing, isLoading } = useFollowStatus(targetUserId);
  const toggle = useToggleFollow(targetUserId);
  const toast = useToast();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    hapticTick();
    setPending(true);
    const result = await toggle.mutate(Boolean(isFollowing));
    setPending(false);
    if (result.error) {
      toast.error(result.error);
    }
  }

  if (isLoading) {
    return <div className="h-9 w-28 animate-pulse rounded-lg bg-surface" />;
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-pressed={Boolean(isFollowing)}
      className={
        isFollowing
          ? "rounded-lg border border-border px-5 py-2 text-sm font-medium text-text transition-transform active:scale-[0.96] disabled:opacity-50"
          : "rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-background transition-transform active:scale-[0.96] disabled:opacity-50"
      }
    >
      {isFollowing ? "Seguindo" : "Seguir"}
    </button>
  );
}
