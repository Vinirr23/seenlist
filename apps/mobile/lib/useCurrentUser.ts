import { useEffect, useState } from "react";
import { fetchCurrentUser, type CurrentUser } from "./currentUser";
import { fetchProfileSectionCounts, type ProfileSectionCounts } from "./profileSectionCounts";
import { fetchSocialCounts, type SocialCounts } from "./socialCounts";

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    fetchCurrentUser()
      .then(setUser)
      .catch((error) => {
        console.error("[useCurrentUser] Falha ao buscar usuário", error);
        setIsError(true);
      })
      .finally(() => setIsLoading(false));
  }, []);

  return { user, isLoading, isError };
}

export function useProfileSectionCounts(userId: string | null) {
  const [counts, setCounts] = useState<ProfileSectionCounts | undefined>(undefined);

  useEffect(() => {
    if (!userId) return;
    fetchProfileSectionCounts(userId).then(setCounts);
  }, [userId]);

  return counts;
}

export function useSocialCounts(userId: string | null) {
  const [counts, setCounts] = useState<SocialCounts | undefined>(undefined);

  useEffect(() => {
    if (!userId) return;
    fetchSocialCounts(userId).then(setCounts);
  }, [userId]);

  return counts;
}
