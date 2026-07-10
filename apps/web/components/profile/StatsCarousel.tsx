"use client";

import { Clock, ListVideo, Film, CheckCircle2, Tv } from "lucide-react";
import { useProfileStats, type ProfileStats } from "@/lib/queries/profile-stats";
import { formatWatchDuration } from "@/lib/format-duration";
import { StatCard } from "./StatCard";

const numberFormatter = new Intl.NumberFormat("pt-BR");

export interface StatsCarouselProps {
  stats: ProfileStats | undefined;
  isLoading: boolean;
  isError: boolean;
  /** Perfil próprio mostra "Não foi possível carregar suas..."; perfil público mostra "as estatísticas deste perfil". */
  ownerLabel?: "own" | "other";
}

/**
 * TASK-028, item 5 — vira componente puro (recebe os dados prontos)
 * em vez de buscar sozinho, pra poder ser reaproveitado pelo perfil
 * público (`usePublicStats`) sem duplicar o carrossel inteiro. A
 * lista de 8 cards agora bate exatamente com o que o item 5 pede —
 * antes tinha um conjunto um pouco diferente (série pausada, assistir
 * depois); trocado pra "séries/filmes na biblioteca" e "filmes
 * concluídos", como pedido explicitamente aqui.
 */
export function StatsCarousel({ stats, isLoading, isError, ownerLabel = "own" }: StatsCarouselProps) {
  if (isLoading) {
    return (
      <section className="mb-6">
        <h2 className="mb-3 px-1 text-lg font-bold text-text">Estatísticas</h2>
        <div className="flex gap-3 overflow-hidden" aria-busy="true" aria-label="Carregando estatísticas">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-32 w-40 shrink-0 animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
      </section>
    );
  }

  if (isError || !stats) {
    return (
      <section className="mb-6">
        <h2 className="mb-3 px-1 text-lg font-bold text-text">Estatísticas</h2>
        <p className="text-sm text-muted">
          {ownerLabel === "own"
            ? "Não foi possível carregar suas estatísticas agora."
            : "Não foi possível carregar as estatísticas deste perfil agora."}
        </p>
      </section>
    );
  }

  const seriesTime = formatWatchDuration(stats.seriesWatchMinutes);
  const movieTime = formatWatchDuration(stats.movieWatchMinutes);

  const cards = [
    { icon: Clock, title: "Tempo vendo séries", value: seriesTime.primary, subtext: seriesTime.secondary },
    { icon: ListVideo, title: "Episódios assistidos", value: numberFormatter.format(stats.episodesWatched) },
    { icon: Film, title: "Tempo vendo filmes", value: movieTime.primary, subtext: movieTime.secondary },
    { icon: CheckCircle2, title: "Filmes concluídos", value: numberFormatter.format(stats.moviesCompleted) },
    { icon: CheckCircle2, title: "Séries concluídas", value: numberFormatter.format(stats.seriesCompleted) },
    { icon: Tv, title: "Séries na biblioteca", value: numberFormatter.format(stats.seriesInLibrary) },
    { icon: Film, title: "Filmes na biblioteca", value: numberFormatter.format(stats.moviesInLibrary) },
  ];

  return (
    <section className="mb-6">
      <h2 className="mb-3 px-1 text-lg font-bold text-text">Estatísticas</h2>
      <div
        className={
          "-mx-4 flex gap-3 overflow-x-auto scroll-smooth px-4 pb-1 snap-x snap-mandatory " +
          "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        }
      >
        {cards.map((card) => (
          <StatCard key={card.title} icon={card.icon} title={card.title} value={card.value} subtext={card.subtext} />
        ))}
      </div>
    </section>
  );
}

/** Wrapper pra manter o call site antigo (`<MyStatsCarousel />`, sem props) funcionando no Perfil próprio. */
export function MyStatsCarousel() {
  const { data: stats, isLoading, isError } = useProfileStats();
  return <StatsCarousel stats={stats} isLoading={isLoading} isError={isError} ownerLabel="own" />;
}
