import { useCallback, useEffect, useState } from "react";
import { fetchLibraryItems } from "@/lib/library";
import { fetchPublicLibraryItems } from "@/lib/publicProfile";
import { computeProfileStats, type ProfileStats } from "./profileStats";
import { useTranslation } from "./i18n/LocaleProvider";

export function useProfileStats() {
  const { locale } = useTranslation();
  const [stats, setStats] = useState<ProfileStats | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setIsError(false);
    fetchLibraryItems(undefined, locale)
      .then((items) => {
        if (!cancelled) setStats(computeProfileStats(items));
      })
      .catch((error) => {
        console.error("[useProfileStats] Falha ao calcular estatísticas", error);
        if (!cancelled) setIsError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken, locale]);

  const refetch = useCallback(() => setReloadToken((n) => n + 1), []);

  return { stats, isLoading, isError, refetch };
}

export function usePublicProfileStats(userId: string | null) {
  const { locale } = useTranslation();
  const [stats, setStats] = useState<ProfileStats | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setIsLoading(true);
    setIsError(false);
    fetchPublicLibraryItems(userId, locale)
      .then((items) => {
        if (!cancelled) setStats(computeProfileStats(items));
      })
      .catch((error) => {
        console.error("[usePublicProfileStats] Falha ao calcular estatísticas", error);
        if (!cancelled) setIsError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, reloadToken, locale]);

  const refetch = useCallback(() => setReloadToken((n) => n + 1), []);

  return { stats, isLoading, isError, refetch };
}
