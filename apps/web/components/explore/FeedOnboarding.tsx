"use client";

import { useState } from "react";
import { useSetFeedCategories, type FeedCategoryKey } from "@/lib/queries/feed-categories";
import { CategoryPicker } from "./CategoryPicker";
import { hapticTick } from "@/lib/haptics";

/**
 * TASK-059 — "enquanto o usuário não selecionar pelo menos uma
 * categoria, o Feed não será exibido". Quem decide MOSTRAR essa tela
 * é o chamador (ExploreFeedTab), verificando se
 * useMyFeedCategories() veio vazio — este componente só cuida da
 * seleção em si.
 */
export function FeedOnboarding() {
  const [selected, setSelected] = useState<FeedCategoryKey[]>([]);
  const setCategories = useSetFeedCategories();

  function toggle(key: FeedCategoryKey) {
    hapticTick();
    setSelected((current) => (current.includes(key) ? current.filter((k) => k !== key) : [...current, key]));
  }

  return (
    <div className="px-4 pt-6 pb-24">
      <h1 className="text-xl font-bold text-text">Quais assuntos você quer acompanhar?</h1>
      <p className="mt-1 text-sm text-muted">Escolha um ou mais — dá pra mudar depois nas configurações.</p>

      <div className="mt-5">
        <CategoryPicker selected={selected} onToggle={toggle} />
      </div>

      <button
        type="button"
        onClick={() => setCategories.mutate(selected)}
        disabled={selected.length === 0 || setCategories.isPending}
        className="mt-6 w-full rounded-lg bg-primary py-3 text-sm font-bold text-background disabled:opacity-40"
      >
        {setCategories.isPending ? "Salvando..." : "Continuar"}
      </button>
    </div>
  );
}
