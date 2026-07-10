"use client";

import { useCurrentUser } from "@/lib/queries/current-user";
import { UserListPageView } from "@/components/profile/UserListPageView";

export default function FollowersPage() {
  const { data: user } = useCurrentUser();
  if (!user) return null;
  return <UserListPageView userId={user.id} direction="followers" title="Seguidores" />;
}
