"use client";

import { useCurrentUser } from "@/lib/queries/current-user";
import { UserListPageView } from "@/components/profile/UserListPageView";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export default function FollowersPage() {
  const { data: user } = useCurrentUser();
  const { t } = useTranslation();
  if (!user) return null;
  return <UserListPageView userId={user.id} direction="followers" title={t("profile.followers")} />;
}
