import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";

export type ViewMode = "grid" | "list";

function isViewMode(value: unknown): value is ViewMode {
  return value === "grid" || value === "list";
}

/**
 * TASK-116 (correção — Perfil) — porta de `useViewModePreference.ts`.
 * Cada tela chama com seu próprio `scope` ("profile-series",
 * "profile-movies" etc.) — trocar numa tela não afeta as outras,
 * mesma regra do web. `AsyncStorage` no lugar de `localStorage`
 * (responde na hora); `user_metadata` do Supabase mantém entre
 * aparelhos, mesma estratégia dos dois lados.
 */
export function useViewModePreference(scope: string) {
  const storageKey = `seenlist:viewMode:${scope}`;
  const metadataKey = `viewMode_${scope}`;
  const [viewMode, setViewModeState] = useState<ViewMode>("grid");

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(storageKey).then((stored) => {
      if (cancelled) return;
      if (isViewMode(stored)) {
        setViewModeState(stored);
        return;
      }
      supabase.auth.getUser().then(({ data }) => {
        if (cancelled) return;
        const saved = data.user?.user_metadata?.[metadataKey];
        if (isViewMode(saved)) setViewModeState(saved);
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  function setViewMode(next: ViewMode) {
    setViewModeState(next);
    AsyncStorage.setItem(storageKey, next);
    supabase.auth.updateUser({ data: { [metadataKey]: next } }).catch((error) => {
      console.error(`[view-mode] Falha ao salvar preferência de visualização (${scope})`, error);
    });
  }

  return { viewMode, setViewMode };
}
