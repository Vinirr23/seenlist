import { memo } from "react";
import type { LibraryItem } from "@seenlist/types";
import { ContinueWatchingCard } from "./ContinueWatchingCard";
import { HomeEmptyState } from "../media/HomeEmptyState";

export interface ContinueWatchingSectionProps {
  items: LibraryItem[];
  isLoading: boolean;
}

/**
 * TASK-055 — "Continue assistindo" enriquecido: de pôsteres em carrossel
 * horizontal (MediaShelf) pra uma lista vertical de cards ricos por
 * episódio, no nível do TV Time. `ContinueWatchingCard` retorna `null`
 * sozinho quando a série já não tem episódio pendente (ex.: acabou de
 * assistir tudo) — por isso o filtro de "quais séries aparecem aqui"
 * continua vindo de fora (`items`, já filtrado por status "watching"),
 * sem duplicar essa regra aqui dentro.
 */
export const ContinueWatchingSection = memo(function ContinueWatchingSection({
  items,
  isLoading,
}: ContinueWatchingSectionProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-surface" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <HomeEmptyState
        message="Você ainda não está acompanhando nenhuma série."
        actionLabel="Explorar séries"
        actionHref="/explore"
      />
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <ContinueWatchingCard key={item.id} item={item} />
      ))}
    </div>
  );
});
