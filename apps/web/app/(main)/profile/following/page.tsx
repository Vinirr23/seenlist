"use client";

import { useCurrentUser } from "@/lib/queries/current-user";
import { UserListPageView } from "@/components/profile/UserListPageView";

export default function FollowingPage() {
  const { data: user } = useCurrentUser();
  if (!user) return null;
  return <UserListPageView userId={user.id} direction="following" title="Seguindo" />;
}
