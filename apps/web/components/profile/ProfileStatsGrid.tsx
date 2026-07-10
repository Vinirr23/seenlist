"use client";

import { Film, Tv, CheckCircle2, ListVideo } from "lucide-react";
import { useProfileStats } from "@/lib/queries/profile-stats";
import { StatCard } from "./StatCard";

const numberFormatter = new Intl.NumberFormat("pt-BR");

/**
 * Ajuste — virou carrossel horizontal, mesmo padrão visual e mesmo
 * componente (`StatCard`) já usados por `StatsCarousel` (scroll
 * suave, snap, mesma largura/altura de card, scrollbar escondida).
 * Nenhum valor, cálculo ou consulta mudou — só a apresentação:
 * `useProfileStats()` é o mesmo hook de sempre, sem nenhuma
 * alteração.
 */
export function ProfileStatsGrid() {
  const { data: stats, isLoading, isError } = useProfileStats();

  if (isLoading) {
    return (
      <div
        className="-mx-4 mb-6 flex gap-3 overflow-hidden px-4"
        aria-busy="true"
        aria-label="Carregando estatísticas"
      >
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-28 w-40 shrink-0 animate-pulse rounded-2xl bg-surface" />
        ))}
      </div>
    );
  }

  if (isError || !stats) {
    return <p className="mb-6 text-sm text-muted">Não foi possível carregar suas estatísticas agora.</p>;
  }

  const cards = [
    { icon: Film, title: "Filmes na biblioteca", value: numberFormatter.format(stats.moviesInLibrary) },
    { icon: Tv, title: "Séries na biblioteca", value: numberFormatter.format(stats.seriesInLibrary) },
    { icon: CheckCircle2, title: "Filmes concluídos", value: numberFormatter.format(stats.moviesCompleted) },
    { icon: CheckCircle2, title: "Séries concluídas", value: numberFormatter.format(stats.seriesCompleted) },
    { icon: ListVideo, title: "Episódios assistidos", value: numberFormatter.format(stats.episodesWatched) },
  ];

  return (
    <div className="mb-6">
      <div
        className={
          "-mx-4 flex gap-3 overflow-x-auto scroll-smooth px-4 pb-1 snap-x snap-mandatory " +
          "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        }
      >
        {cards.map((card) => (
          <StatCard key={card.title} icon={card.icon} title={card.title} value={card.value} />
        ))}
      </div>
    </div>
  );
}
