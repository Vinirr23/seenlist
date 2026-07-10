"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type ViewMode = "grid" | "list";

function isViewMode(value: unknown): value is ViewMode {
  return value === "grid" || value === "list";
}

/**
 * Ajuste: a versão anterior (`ViewModeProvider`) era um único valor
 * global — trocar em Séries também mudaria Filmes e Perfil, que não
 * é o que foi pedido ("o botão afeta apenas a tela atual"). Virou um
 * hook simples, sem Context nenhum: cada tela chama com sua própria
 * `scope` ("series-library", "movies-library") e tem sua própria
 * chave de armazenamento, totalmente independente das outras.
 *
 * Mesma estratégia de persistência de sempre — `localStorage`
 * responde na hora, `user_metadata` do Supabase mantém entre
 * dispositivos, sem tabela nova.
 */
export function useViewModePreference(scope: string) {
  const storageKey = `seenlist:viewMode:${scope}`;
  const metadataKey = `viewMode_${scope}`;
  const [viewMode, setViewModeState] = useState<ViewMode>("grid");

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (isViewMode(stored)) {
      setViewModeState(stored);
      return;
    }
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const saved = data.user?.user_metadata?.[metadataKey];
      if (isViewMode(saved)) setViewModeState(saved);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só precisa rodar uma vez por scope, não a cada render
  }, [scope]);

  function setViewMode(next: ViewMode) {
    setViewModeState(next);
    window.localStorage.setItem(storageKey, next);
    const supabase = createClient();
    supabase.auth.updateUser({ data: { [metadataKey]: next } }).catch((error) => {
      console.error(`[view-mode] Falha ao salvar preferência de visualização (${scope})`, error);
    });
  }

  return { viewMode, setViewMode };
}
