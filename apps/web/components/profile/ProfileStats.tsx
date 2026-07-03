"use client";

import { useUserStats } from "@/lib/queries/user-stats";

export function ProfileStats() {
  const { data: stats, isLoading, isError } = useUserStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-3" aria-busy="true" aria-label="Carregando estatísticas">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-16 animate-pulse rounded-lg border border-border bg-surface" />
        ))}
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <p className="text-sm text-muted">Não foi possível carregar suas estatísticas agora.</p>
    );
  }

  const items = [
    { label: "Filmes assistidos", value: stats.moviesWatched },
    { label: "Séries concluídas", value: stats.seriesWatched },
    { label: "Episódios assistidos", value: stats.episodesWatched },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-border bg-surface p-3 text-center">
          <p className="text-lg font-semibold text-text">{item.value}</p>
          <p className="text-[11px] text-muted">{item.label}</p>
        </div>
      ))}
    </div>
  );
}
