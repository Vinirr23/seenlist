import type { MediaSearchResult } from "@seenlist/types";
import type { ParsedShow, ShowMatch } from "../mapping/types";
import { rankCandidates } from "./scoring";
import { cachedSeriesSearch } from "./searchCache";
import { narrowByWatchHistory } from "./disambiguateByHistory";
import { fetchKnownMappings, saveMapping } from "./equivalenceTable";
import { PendencyDiagnosticsCollector } from "../diagnostics-detail/pendencyDiagnostics";
import { normalizeTitle } from "./titleNormalization";

/**
 * Ajuste — trocado de "regra rígida" (só aceita se tiver exatamente
 * 1 resultado, ou ano batendo perfeitamente) por pontuação (item 1).
 * A versão anterior jogava a maioria das séries pra seleção manual
 * porque exigia quase coincidência perfeita — na prática, buscas de
 * nome de série quase sempre trazem VÁRIOS resultados (speciais,
 * spin-offs, remakes, séries de outro país com nome parecido).
 *
 * AUTO_ACCEPT_THRESHOLD: 60 é a pontuação de um nome EXATAMENTE
 * igual mesmo sem confirmação de ano (ver scoring.ts — match exato
 * de nome já vale 65 sozinho). MIN_LEAD garante que só aceita
 * sozinho quando o 1º colocado está claramente à frente do 2º — se
 * os dois estão empatados tecnicamente, é ambiguidade de verdade,
 * não falta de confiança no algoritmo.
 *
 * Ajuste (histórico) — caso "Avatar: The Last Airbender" (original
 * 2005) vs "Avatar: O Último Mestre do Ar" (remake 2024): nome e ano
 * não bastam quando duas séries têm nome original idêntico. Antes de
 * desistir pra seleção manual, os candidatos que sobraram ambíguos
 * passam por `narrowByWatchHistory`.
 *
 * TASK-027.5 — antes de tudo isso, `matchAllShows` busca o banco de
 * equivalências (`tvtime_tmdb_mappings`) pra TODAS as séries de uma
 * vez. Série com mapeamento já confirmado (por qualquer usuário,
 * qualquer importação anterior) nunca chega a `matchShow` — pula
 * direto pra "matched", sem gastar nenhuma chamada ao TMDB.
 *
 * Ajuste (bug corrigido) — a popularidade já desempatava a ORDEM de
 * exibição em empate técnico de score (rankCandidates), mas isso
 * nunca contava pra decisão de aceitar sozinho: a diferença de score
 * continua pequena por definição de empate, então a série ia pra
 * seleção manual mesmo quando a popularidade já respondia com
 * clareza (ex.: "Avatar: The Last Airbender" 2005 vs 2024 — nome
 * original idêntico nos dois, sem ano do lado do TV Time pra
 * desempatar). Agora, quando o placar está tecnicamente empatado E
 * o 1º colocado tem pelo menos o dobro da popularidade do 2º, isso
 * conta como decisão — não só como ordenação.
 *
 * TASK-027E — instrumentação PURA adicionada abaixo: quando uma
 * série vira "ambiguous"/"not_found", um `PendencyDiagnosticsCollector`
 * opcional registra o motivo. Nada nesta função muda de
 * comportamento por causa disso — o coletor só observa decisões já
 * tomadas pelas condições acima, nunca influencia nenhuma delas.
 *
 * TASK-027F — causa raiz real de boa parte das pendências: o TV Time
 * exporta muitas séries como "Nome (Ano)" (ex.: "Wrecked (2016)"), e
 * esse texto INTEIRO ia direto pra query de busca no TMDB.
 * `scoring.ts` já ignorava esse padrão ao COMPARAR nomes depois que
 * os resultados voltavam — mas a busca em si nunca se beneficiava
 * dessa limpeza. Agora `normalizeTitle()` roda antes de qualquer
 * busca, extraindo o ano como dado (não como texto) e devolvendo uma
 * query limpa — ver titleNormalization.ts.
 */
const AUTO_ACCEPT_THRESHOLD = 60;
const MIN_LEAD_OVER_SECOND = 15;
const MAX_CANDIDATES_SHOWN = 5;
const SCORE_TIE_THRESHOLD = 3;
const MIN_POPULARITY_RATIO_FOR_TIEBREAK = 2;

async function searchSeries(query: string): Promise<MediaSearchResult[]> {
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
  if (!response.ok) throw new Error("search failed");
  const data = (await response.json()) as { results: MediaSearchResult[] };
  return data.results.filter((result) => result.mediaType === "series");
}

async function matchShow(show: ParsedShow, diagnostics?: PendencyDiagnosticsCollector): Promise<ShowMatch> {
  try {
    // TASK-027F — normalização acontece aqui, antes de qualquer
    // busca. "Wrecked (2016)" vira query "Wrecked" + ano 2016
    // separado; o texto original (show.name) continua intacto pra
    // todo log/exibição.
    const { normalizedTitle, extractedYear } = normalizeTitle(show.name);
    if (normalizedTitle !== show.name) {
      console.log(`[tvtime-import] "${show.name}" → busca normalizada: "${normalizedTitle}"${extractedYear ? ` (ano extraído: ${extractedYear})` : ""}`);
    }

    const results = await cachedSeriesSearch(normalizedTitle, searchSeries);

    if (results.length === 0) {
      console.log(`[tvtime-import] "${show.name}" — nenhum resultado no TMDB`);
      diagnostics?.record(show, [], {}, AUTO_ACCEPT_THRESHOLD, "Não encontrada");
      return { show, status: "not_found", tmdbId: null, candidates: [], matchReason: "nenhum resultado no TMDB" };
    }

    const ranked = rankCandidates(
      normalizedTitle,
      extractedYear ?? show.year,
      results.map((result) => ({
        tmdbId: result.id,
        title: result.title,
        originalTitle: result.originalTitle ?? null,
        year: result.year,
        popularity: result.popularity ?? 0,
      }))
    );

    const [best, second] = ranked;
    if (!best) {
      return { show, status: "not_found", tmdbId: null, candidates: [], matchReason: "nenhum resultado no TMDB" };
    }
    const lead = second ? best.score - second.score : Infinity;
    const isNearTie = second !== undefined && Math.abs(best.score - second.score) <= SCORE_TIE_THRESHOLD;
    const popularityDecisive =
      isNearTie &&
      second !== undefined &&
      second.popularity > 0 &&
      best.popularity >= second.popularity * MIN_POPULARITY_RATIO_FOR_TIEBREAK;

    const confident = best.score >= AUTO_ACCEPT_THRESHOLD && (lead >= MIN_LEAD_OVER_SECOND || popularityDecisive);

    if (confident) {
      const reason = lead >= MIN_LEAD_OVER_SECOND ? "auto" : "auto, desempate por popularidade";
      console.log(`[tvtime-import] "${show.name}" → "${best.title}" (score ${best.score}, ${reason})`);
      void saveMapping(show.tvTimeId, best.tmdbId, show.name, "auto");
      return {
        show,
        status: "matched",
        tmdbId: best.tmdbId,
        candidates: [],
        matchScore: best.score,
        matchedTitle: best.title,
        matchReason: reason,
      };
    }

    // Score não teve confiança sozinho — tenta o histórico antes de desistir.
    const plausible = ranked.slice(0, MAX_CANDIDATES_SHOWN);
    const { remaining: narrowed, summaries } = await narrowByWatchHistory(show, plausible);

    if (narrowed.length === 1) {
      const only = narrowed[0];
      if (!only) {
        // Inalcançável na prática (length === 1 garante isso), só satisfaz o TypeScript.
        return { show, status: "not_found", tmdbId: null, candidates: [], matchReason: "nenhum resultado no TMDB" };
      }
      console.log(`[tvtime-import] "${show.name}" → "${only.title}" (score ${only.score}, confirmado pelo histórico)`);
      void saveMapping(show.tvTimeId, only.tmdbId, show.name, "auto");
      return {
        show,
        status: "matched",
        tmdbId: only.tmdbId,
        candidates: [],
        matchScore: only.score,
        matchedTitle: only.title,
        matchReason: "confirmado pelo histórico de episódios",
      };
    }

    console.log(
      `[tvtime-import] "${show.name}" — ambíguo mesmo após histórico (${narrowed.length} candidatos), indo pra seleção manual`
    );
    diagnostics?.record(show, narrowed, summaries, AUTO_ACCEPT_THRESHOLD, "Confirmação manual");
    return {
      show,
      status: "ambiguous",
      tmdbId: null,
      matchReason: `ambíguo mesmo após histórico (${narrowed.length} candidatos)`,
      candidates: narrowed.map((candidate) => ({
        tmdbId: candidate.tmdbId,
        title: candidate.title,
        year: candidate.year,
        posterPath: results.find((result) => result.id === candidate.tmdbId)?.posterPath ?? null,
        score: candidate.score,
      })),
    };
  } catch (error) {
    console.error(`[tvtime-import] Falha ao buscar "${show.name}" no TMDB`, error);
    return { show, status: "not_found", tmdbId: null, candidates: [], matchReason: "erro ao buscar no TMDB" };
  }
}

/** Chamado quando o usuário resolve manualmente — grava o mapeamento como "manual", pra nunca mais perguntar de novo pra essa série. */
export function confirmManualMapping(show: ParsedShow, tmdbId: number): void {
  void saveMapping(show.tvTimeId, tmdbId, show.name, "manual");
}

const BATCH_SIZE = 6;

export async function matchAllShows(
  shows: ParsedShow[],
  onProgress?: (done: number, total: number) => void
): Promise<ShowMatch[]> {
  const knownMappings = await fetchKnownMappings(shows.map((show) => show.tvTimeId));
  console.log(
    `[tvtime-import] ${knownMappings.size} de ${shows.length} séries já tinham mapeamento conhecido — pulando busca no TMDB pra essas`
  );

  // TASK-027E — instrumentação, nenhuma influência nas linhas acima/abaixo que decidem o resultado.
  const diagnostics = new PendencyDiagnosticsCollector();

  const results: ShowMatch[] = new Array(shows.length);
  const toSearch: { show: ParsedShow; index: number }[] = [];

  shows.forEach((show, index) => {
    const knownTmdbId = knownMappings.get(show.tvTimeId);
    if (knownTmdbId !== undefined) {
      results[index] = {
        show,
        status: "matched",
        tmdbId: knownTmdbId,
        candidates: [],
        matchReason: "equivalência salva (importação anterior)",
      };
    } else {
      toSearch.push({ show, index });
    }
  });

  let done = shows.length - toSearch.length;
  onProgress?.(done, shows.length);

  for (let start = 0; start < toSearch.length; start += BATCH_SIZE) {
    const batch = toSearch.slice(start, start + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map((entry) => matchShow(entry.show, diagnostics)));
    batch.forEach((entry, offset) => {
      const result = batchResults[offset];
      if (result) results[entry.index] = result;
    });
    done += batch.length;
    onProgress?.(done, shows.length);
  }

  const matched = results.filter((r) => r.status === "matched").length;
  const pending = results.filter((r) => r.status === "ambiguous" || r.status === "not_found").length;
  console.log(`[tvtime-import] Matching concluído: ${matched} automáticas, ${pending} precisam de ajuda`);

  // TASK-027E — relatório de diagnóstico das pendências, sempre impresso (é o objetivo desta tarefa: dados concretos, não um modo dev escondido).
  diagnostics.print();
  diagnostics.printSummary();

  return results;
}
