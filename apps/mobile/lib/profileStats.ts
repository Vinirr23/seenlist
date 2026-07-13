import type { LibraryItem } from "@seenlist/types";

export interface ProfileStats {
  moviesInLibrary: number;
  seriesInLibrary: number;
  moviesCompleted: number;
  seriesCompleted: number;
  episodesWatched: number;
  seriesWatchMinutes: number;
  movieWatchMinutes: number;
}

/**
 * TASK-108 (Estatísticas) — porta fiel de `computeProfileStats` do
 * web (só os 7 campos que o `StatsCarousel` realmente usa — o tipo
 * completo do web tem mais alguns, calculados mas não exibidos no
 * carrossel; omiti os que nenhuma tela nativa usa ainda). Função
 * pura, sem chamada nenhuma ao Supabase/TMDB — os dados já vêm de
 * `fetchLibraryItems`/`fetchPublicLibraryItems`, que o app já busca
 * de qualquer forma pras abas Séries/Filmes e pro Perfil Público.
 */
export function computeProfileStats(items: LibraryItem[]): ProfileStats {
  let moviesInLibrary = 0;
  let seriesInLibrary = 0;
  let moviesCompleted = 0;
  let seriesCompleted = 0;
  let episodesWatched = 0;
  let seriesWatchMinutes = 0;
  let movieWatchMinutes = 0;

  for (const item of items) {
    if (item.mediaType === "movie") {
      moviesInLibrary += 1;
      if (item.status === "completed") {
        moviesCompleted += 1;
        movieWatchMinutes += item.runtimeMinutes ?? 0;
      }
    } else {
      seriesInLibrary += 1;
      const watchEvents = item.progress?.totalWatchEvents ?? item.progress?.watchedEpisodes ?? 0;
      episodesWatched += watchEvents;
      seriesWatchMinutes += watchEvents * (item.runtimeMinutes ?? 0);
      if (item.status === "completed") seriesCompleted += 1;
    }
  }

  return { moviesInLibrary, seriesInLibrary, moviesCompleted, seriesCompleted, episodesWatched, seriesWatchMinutes, movieWatchMinutes };
}

export interface FormattedDuration {
  primary: string;
  secondary?: string;
}

function unit(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/** Idêntico a formatWatchDuration do web — sempre mostra a maior unidade não-zero, com até duas unidades menores de subtexto. */
export function formatWatchDuration(totalMinutes: number): FormattedDuration {
  if (totalMinutes <= 0) return { primary: "0 horas" };

  const totalHours = Math.round(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);
  const remHours = totalHours % 24;
  const years = Math.floor(totalDays / 365);
  const remDaysAfterYears = totalDays % 365;
  const months = Math.floor(remDaysAfterYears / 30);
  const days = remDaysAfterYears % 30;

  if (years > 0) {
    const secondary = [months > 0 ? unit(months, "mês", "meses") : null, days > 0 ? unit(days, "dia", "dias") : null]
      .filter(Boolean)
      .join(" · ");
    return { primary: unit(years, "ano", "anos"), secondary: secondary || undefined };
  }

  if (months > 0) {
    const secondary = [days > 0 ? unit(days, "dia", "dias") : null, remHours > 0 ? unit(remHours, "hora", "horas") : null]
      .filter(Boolean)
      .join(" · ");
    return { primary: unit(months, "mês", "meses"), secondary: secondary || undefined };
  }

  if (totalDays > 0) {
    return { primary: unit(totalDays, "dia", "dias"), secondary: remHours > 0 ? unit(remHours, "hora", "horas") : undefined };
  }

  return { primary: unit(totalHours, "hora", "horas") };
}
