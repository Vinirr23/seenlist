import type { ParsedShow } from "../mapping/types";
import type { ScoredCandidate } from "./scoring";
import { normalizeName } from "./scoring";

export interface SeasonSummary {
  numberOfSeasons: number;
  seasons: { seasonNumber: number; episodeCount: number }[];
  alternativeTitles: string[];
}

/**
 * Ajuste — caso "Avatar: The Last Airbender" (2005, animada) vs
 * "Avatar: O Último Mestre do Ar" (2024, live-action): as duas
 * costumam ter o MESMO nome original em inglês, então nome e ano
 * sozinhos não distinguem. A saída é usar `show.knownEpisodes`
 * (TASK-027B — sinal granular real, mas esparso: vem de
 * watched_on_episode.csv/rewatched_episode.csv/seen_episode_latest.csv,
 * cobre só uma fração pequena da biblioteca): se existe pelo menos um
 * episódio confirmado da Temporada 2, qualquer candidato com só 1
 * temporada está automaticamente descartado — não interessa o quão
 * parecido o nome seja. Quando não há nenhum episódio granular
 * conhecido pra essa série (o caso mais comum), esta checagem
 * simplesmente não roda — não é uma limitação nova desta função, é a
 * mesma limitação de cobertura do arquivo, documentada em
 * /docs/tvtime-gdpr-spec.md.
 *
 * Só roda para candidatos que JÁ chegaram aqui ambíguos (a etapa
 * de score em scoring.ts não teve confiança pra decidir sozinha) —
 * por isso busca detalhe completo (temporada/episódio) só de poucos
 * candidatos, não da lista inteira da importação.
 */
function highestWatched(show: ParsedShow): { season: number; episodeInThatSeason: number } | null {
  if (show.knownEpisodes.length === 0) return null;

  let bestSeason = 0;
  let bestEpisode = 0;
  for (const episode of show.knownEpisodes) {
    if (
      episode.seasonNumber > bestSeason ||
      (episode.seasonNumber === bestSeason && episode.episodeNumber > bestEpisode)
    ) {
      bestSeason = episode.seasonNumber;
      bestEpisode = episode.episodeNumber;
    }
  }
  return bestSeason > 0 ? { season: bestSeason, episodeInThatSeason: bestEpisode } : null;
}

function isCompatible(summary: SeasonSummary, season: number, episodeInThatSeason: number): boolean {
  if (summary.numberOfSeasons < season) return false;
  const seasonEntry = summary.seasons.find((entry) => entry.seasonNumber === season);
  // Não achou a temporada na resposta do TMDB (numeração diferente,
  // especial etc.) — não penaliza por falta de dado, só não confirma.
  if (!seasonEntry) return true;
  return seasonEntry.episodeCount >= episodeInThatSeason;
}

async function fetchSeasonSummaries(tmdbIds: number[]): Promise<Record<number, SeasonSummary>> {
  if (tmdbIds.length === 0) return {};
  const response = await fetch("/api/tvtime-import/season-info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seriesIds: tmdbIds }),
  });
  if (!response.ok) throw new Error("season-info failed");
  const data = (await response.json()) as { results: Record<number, SeasonSummary> };
  return data.results;
}

export interface NarrowResult {
  remaining: ScoredCandidate[];
  /** TASK-027E — exposto pra diagnóstico (ver diagnostics/pendencyDiagnostics.ts). Não influencia a decisão acima, só evita ter que buscar de novo o que essa função já buscou. */
  summaries: Record<number, SeasonSummary>;
}

export async function narrowByWatchHistory(show: ParsedShow, candidates: ScoredCandidate[]): Promise<NarrowResult> {
  const watched = highestWatched(show);
  if (candidates.length <= 1) return { remaining: candidates, summaries: {} };

  try {
    const summaries = await fetchSeasonSummaries(candidates.map((candidate) => candidate.tmdbId));

    let remaining = candidates;
    if (watched) {
      const compatible = candidates.filter((candidate) => {
        const summary = summaries[candidate.tmdbId];
        if (!summary) return true; // falha ao buscar detalhe desse candidato — não descarta por falta de dado
        return isCompatible(summary, watched.season, watched.episodeInThatSeason);
      });

      if (compatible.length === 0) {
        console.warn(
          `[tvtime-import] "${show.name}" — histórico (T${watched.season}E${watched.episodeInThatSeason}) eliminaria todos os candidatos; mantendo lista original.`
        );
      } else {
        if (compatible.length < candidates.length) {
          console.log(
            `[tvtime-import] "${show.name}" — histórico (T${watched.season}E${watched.episodeInThatSeason}) descartou ${candidates.length - compatible.length} candidato(s) incompatível(is)`
          );
        }
        remaining = compatible;
      }
    }

    if (remaining.length > 1) {
      // Histórico não bastou sozinho — tenta por alias (TASK-027.5,
      // critério "aliases"): se só UM candidato tem um título
      // alternativo batendo exatamente com o nome do TV Time, isso
      // já é sinal forte o bastante pra decidir sozinho.
      const normalizedQuery = normalizeName(show.name);
      const matchingAlias = remaining.filter((candidate) => {
        const summary = summaries[candidate.tmdbId];
        return summary?.alternativeTitles.some((title) => normalizeName(title) === normalizedQuery) ?? false;
      });
      if (matchingAlias.length === 1) {
        console.log(`[tvtime-import] "${show.name}" — desambiguado por título alternativo`);
        remaining = matchingAlias;
      }
    }

    return { remaining, summaries };
  } catch (error) {
    console.error(`[tvtime-import] Falha ao validar "${show.name}" pelo histórico/aliases — seguindo sem essa checagem`, error);
    return { remaining: candidates, summaries: {} };
  }
}
