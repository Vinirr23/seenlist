import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  fetchTraktMovieHistory,
  fetchTraktEpisodeHistory,
  fetchTraktMovieRatings,
  fetchTraktShowRatings,
  fetchTraktMovieWatchlist,
  fetchTraktShowWatchlist,
} from "@/lib/trakt/client";

export interface TraktImportMovie {
  tmdbId: number;
  title: string;
  watched: boolean;
  rating: number | null;
  wantToWatch: boolean;
}

export interface TraktImportSeries {
  tmdbId: number;
  title: string;
  watchedEpisodes: { seasonNumber: number; episodeNumber: number }[];
  rating: number | null;
  wantToWatch: boolean;
}

export interface TraktImportData {
  movies: TraktImportMovie[];
  series: TraktImportSeries[];
  /** Itens do Trakt sem ID do TMDB (raro) — não dá pra importar sem inventar uma correspondência, mesmo raciocínio de sempre: melhor não importar do que importar errado. */
  skippedCount: number;
}

/**
 * TASK-171 — busca tudo do Trakt de uma vez (histórico de filme,
 * histórico de episódio, avaliações, watchlist — 6 chamadas, cada
 * uma já paginada por dentro) e organiza num formato só, um registro
 * por filme/série, pronto pro assistente mostrar um resumo e depois
 * gravar no Supabase. Não escreve nada no banco aqui — só busca e
 * organiza; a gravação de verdade acontece no navegador (mesmo
 * cliente Supabase autenticado de sempre, com RLS normal — dado de
 * biblioteca é do próprio usuário, não precisa de chave de serviço).
 */
export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("trakt_access_token")?.value;
  if (!accessToken) {
    return NextResponse.json({ error: "Não conectado ao Trakt." }, { status: 401 });
  }

  try {
    const [movieHistory, episodeHistory, movieRatings, showRatings, movieWatchlist, showWatchlist] = await Promise.all([
      fetchTraktMovieHistory(accessToken),
      fetchTraktEpisodeHistory(accessToken),
      fetchTraktMovieRatings(accessToken),
      fetchTraktShowRatings(accessToken),
      fetchTraktMovieWatchlist(accessToken),
      fetchTraktShowWatchlist(accessToken),
    ]);

    let skippedCount = 0;
    const moviesById = new Map<number, TraktImportMovie>();
    const seriesById = new Map<number, TraktImportSeries>();

    function getOrCreateMovie(tmdbId: number, title: string): TraktImportMovie {
      let entry = moviesById.get(tmdbId);
      if (!entry) {
        entry = { tmdbId, title, watched: false, rating: null, wantToWatch: false };
        moviesById.set(tmdbId, entry);
      }
      return entry;
    }

    function getOrCreateSeries(tmdbId: number, title: string): TraktImportSeries {
      let entry = seriesById.get(tmdbId);
      if (!entry) {
        entry = { tmdbId, title, watchedEpisodes: [], rating: null, wantToWatch: false };
        seriesById.set(tmdbId, entry);
      }
      return entry;
    }

    for (const item of movieHistory) {
      const tmdbId = item.movie?.ids.tmdb;
      if (!tmdbId) {
        skippedCount++;
        continue;
      }
      getOrCreateMovie(tmdbId, item.movie?.title ?? `Filme #${tmdbId}`).watched = true;
    }

    for (const item of episodeHistory) {
      const tmdbId = item.show?.ids.tmdb;
      if (!tmdbId || !item.episode) {
        skippedCount++;
        continue;
      }
      const series = getOrCreateSeries(tmdbId, item.show?.title ?? `Série #${tmdbId}`);
      const alreadyThere = series.watchedEpisodes.some(
        (e) => e.seasonNumber === item.episode!.season && e.episodeNumber === item.episode!.number
      );
      if (!alreadyThere) {
        series.watchedEpisodes.push({ seasonNumber: item.episode.season, episodeNumber: item.episode.number });
      }
    }

    for (const item of movieRatings) {
      const tmdbId = item.movie?.ids.tmdb;
      if (!tmdbId) {
        skippedCount++;
        continue;
      }
      getOrCreateMovie(tmdbId, item.movie?.title ?? `Filme #${tmdbId}`).rating = item.rating;
    }

    for (const item of showRatings) {
      const tmdbId = item.show?.ids.tmdb;
      if (!tmdbId) {
        skippedCount++;
        continue;
      }
      getOrCreateSeries(tmdbId, item.show?.title ?? `Série #${tmdbId}`).rating = item.rating;
    }

    for (const item of movieWatchlist) {
      const tmdbId = item.movie?.ids.tmdb;
      if (!tmdbId) {
        skippedCount++;
        continue;
      }
      getOrCreateMovie(tmdbId, item.movie?.title ?? `Filme #${tmdbId}`).wantToWatch = true;
    }

    for (const item of showWatchlist) {
      const tmdbId = item.show?.ids.tmdb;
      if (!tmdbId) {
        skippedCount++;
        continue;
      }
      getOrCreateSeries(tmdbId, item.show?.title ?? `Série #${tmdbId}`).wantToWatch = true;
    }

    const payload: TraktImportData = {
      movies: [...moviesById.values()],
      series: [...seriesById.values()],
      skippedCount,
    };
    return NextResponse.json(payload);
  } catch (error) {
    console.error("[trakt/data] Falha ao buscar dados do Trakt", error);
    return NextResponse.json({ error: "Não foi possível buscar seus dados do Trakt agora." }, { status: 502 });
  }
}
