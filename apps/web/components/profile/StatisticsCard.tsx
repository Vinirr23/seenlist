"use client";

import Link from "next/link";
import { BarChart3, ChevronRight } from "lucide-react";
import { useProfileStats } from "@/lib/queries/profile-stats";
import { formatWatchDuration } from "@/lib/format-duration";

const numberFormatter = new Intl.NumberFormat("pt-BR");

/**
 * TASK-054 — substitui ProfileStatsGrid (removido) e o carrossel
 * StatsCarousel no Perfil (o componente continua existindo, só que
 * agora só é usado dentro da própria tela de estatísticas). Um card
 * só, clicável, prévia de 4 números — leva pra /profile/stats. Mesmo
 * hook de sempre (useProfileStats), nenhum cálculo novo.
 */
export function StatisticsCard() {
  const { data: stats, isLoading, isError } = useProfileStats();

  if (isLoading) {
    return <div className="mb-6 h-32 animate-pulse rounded-2xl bg-surface" />;
  }
  if (isError || !stats) {
    return (
      <div className="mb-6 rounded-2xl border border-border bg-surface p-4">
        <p className="text-sm text-muted">Não foi possível carregar suas estatísticas agora.</p>
      </div>
    );
  }

  const seriesTime = formatWatchDuration(stats.seriesWatchMinutes);
  const movieTime = formatWatchDuration(stats.movieWatchMinutes);

  const preview = [
    { label: "Episódios assistidos", value: numberFormatter.format(stats.episodesWatched) },
    { label: "Filmes assistidos", value: numberFormatter.format(stats.moviesCompleted) },
    { label: "Tempo vendo séries", value: seriesTime.primary },
    { label: "Tempo vendo filmes", value: movieTime.primary },
  ];

  return (
    <Link
      href="/profile/stats"
      className="mb-6 block rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-primary/40"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" strokeWidth={2} />
          <h2 className="text-sm font-semibold text-text">Estatísticas</h2>
        </div>
        <ChevronRight className="h-4 w-4 text-muted" strokeWidth={2} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {preview.map((item) => (
          <div key={item.label}>
            <p className="text-lg font-bold text-text">{item.value}</p>
            <p className="text-xs text-muted">{item.label}</p>
          </div>
        ))}
      </div>
    </Link>
  );
}
