"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useMyFeedCategories, useSetFeedCategories, type FeedCategoryKey } from "@/lib/queries/feed-categories";
import { CategoryPicker } from "@/components/explore/CategoryPicker";
import { hapticTick } from "@/lib/haptics";

/**
 * TASK-059 — "depois poderão ser alteradas nas configurações".
 * Reaproveita CategoryPicker inteiro (mesmo componente do
 * onboarding) — só muda o estado inicial (vem preenchido, não vazio)
 * e o rótulo do botão.
 */
export function FeedCategoriesSettingsView() {
  const { data: current, isLoading } = useMyFeedCategories();
  const setCategories = useSetFeedCategories();
  const [selected, setSelected] = useState<FeedCategoryKey[]>([]);

  useEffect(() => {
    if (current) setSelected(current);
  }, [current]);

  function toggle(key: FeedCategoryKey) {
    hapticTick();
    setSelected((c) => (c.includes(key) ? c.filter((k) => k !== key) : [...c, key]));
  }

  return (
    <div className="w-full pb-24 md:mx-auto md:max-w-[430px]">
      <div className="flex items-center gap-3 px-4 pt-4">
        <Link href="/profile/settings" aria-label="Voltar" className="text-text">
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </Link>
        <h1 className="text-lg font-bold text-text">Assuntos do Feed</h1>
      </div>

      <div className="px-4 pt-4">
        {isLoading ? (
          <div className="h-40 animate-pulse rounded-lg bg-surface" />
        ) : (
          <>
            <CategoryPicker selected={selected} onToggle={toggle} />
            <button
              type="button"
              onClick={() => setCategories.mutate(selected)}
              disabled={selected.length === 0 || setCategories.isPending}
              className="mt-6 w-full rounded-lg bg-primary py-3 text-sm font-bold text-background disabled:opacity-40"
            >
              {setCategories.isPending ? "Salvando..." : "Salvar"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
