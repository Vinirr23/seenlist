import type { LibraryItem } from "@seenlist/types";

export interface ProfileStats {
  moviesInLibrary: number;
  seriesInLibrary: number;
  moviesCompleted: number;
  seriesCompleted: number;
  episodesWatched: number;
  seriesWatchMinutes: number;
  movieWatchMinutes: number;
  seriesWatching: number;
  seriesUpToDate: number;
  seriesPaused: number;
  seriesWantToWatch: number;
  episodesRemaining: number;
}

/**
 * TASK-108/117 (Estatísticas) — porta fiel de `computeProfileStats`
 * do web. Correção (TASK-117): faltavam `seriesWatching`,
 * `seriesUpToDate`, `seriesPaused`, `seriesWantToWatch` e
 * `episodesRemaining` — eu tinha portado só os 7 campos que o
 * carrossel simples usa, sem checar o tipo completo real; a tela de
 * Estatísticas de verdade (com abas) precisa desses 5 a mais.
 */
export function computeProfileStats(items: LibraryItem[]): ProfileStats {
  let moviesInLibrary = 0;
  let seriesInLibrary = 0;
  let moviesCompleted = 0;
  let seriesCompleted = 0;
  let episodesWatched = 0;
  let seriesWatchMinutes = 0;
  let movieWatchMinutes = 0;
  let seriesWatching = 0;
  let seriesUpToDate = 0;
  let seriesPaused = 0;
  let seriesWantToWatch = 0;
  let episodesRemaining = 0;

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
      if (item.status === "watching") seriesWatching += 1;
      if (item.status === "up_to_date") seriesUpToDate += 1;
      if (item.status === "paused") seriesPaused += 1;
      if (item.status === "want_to_watch") seriesWantToWatch += 1;

      if (["watching", "up_to_date", "paused"].includes(item.status) && item.progress) {
        episodesRemaining += Math.max(0, item.progress.totalEpisodes - item.progress.watchedEpisodes);
      }
    }
  }

  return {
    moviesInLibrary,
    seriesInLibrary,
    moviesCompleted,
    seriesCompleted,
    episodesWatched,
    seriesWatchMinutes,
    movieWatchMinutes,
    seriesWatching,
    seriesUpToDate,
    seriesPaused,
    seriesWantToWatch,
    episodesRemaining,
  };
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
