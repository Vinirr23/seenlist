import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase, getCurrentAuthUser } from "@/lib/supabase";

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
 *
 * CORREÇÃO DE CAUSA RAIZ (2026-09-04 — "esqueleto no formato errado
 * por um instante", auditoria web-vs-mobile — mesmo bug do web, ver
 * comentário grande de `isReady` em `useViewModePreference.ts` do
 * web) — `viewMode` sempre começava em `"grid"` e só era corrigido pro
 * valor de verdade DEPOIS que `AsyncStorage.getItem` (assíncrono)
 * resolvia. Pra quem tem "lista" salva, quem usa este hook pra decidir
 * o FORMATO do esqueleto de carregamento (`LibraryGridSkeleton` vs
 * `LibraryListSkeleton`) desenhava o esqueleto errado (grade) por um
 * instante, trocando pro formato certo (lista) assim que o
 * `AsyncStorage` respondia — visível como "esqueleto piscando/
 * trocando de formato". `isReady` só vira `true` depois que o valor
 * real já foi conferido — quem desenha algo que depende do formato
 * deve esperar `isReady` antes de decidir o que mostrar.
 */
export function useViewModePreference(scope: string) {
  const storageKey = `seenlist:viewMode:${scope}`;
  const metadataKey = `viewMode_${scope}`;
  const [viewMode, setViewModeState] = useState<ViewMode>("grid");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(storageKey).then((stored) => {
      if (cancelled) return;
      if (isViewMode(stored)) {
        setViewModeState(stored);
        setIsReady(true);
        return;
      }
      // Sem nada salvo ainda neste aparelho — "grid" já é a melhor
      // suposição possível, não precisa esperar a rede (busca do
      // `user_metadata`) pra liberar a tela pra desenhar.
      setIsReady(true);
      getCurrentAuthUser().then(({ data }) => {
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

  return { viewMode, setViewMode, isReady };
}
