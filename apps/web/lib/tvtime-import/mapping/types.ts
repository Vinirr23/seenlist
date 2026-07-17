/**
 * TASK-027B — tipos reconstruídos em torno dos arquivos REAIS
 * confirmados por inspeção direta de um export de verdade (ver
 * /docs/tvtime-gdpr-spec.md). Substitui completamente o modelo da
 * TASK-027A (2 arquivos "tracking-prod-records*" que não existem).
 *
 * Mudança de estratégia mais importante: `watchedEpisodes` deixou de
 * ser "a lista de episódios assistidos". Ela não existe no GDPR pra
 * maioria das séries — só uma CONTAGEM total (`totalWatchEvents`).
 * A lista de episódios específicos só é conhecida quando o TMDB já
 * foi consultado e a reconstrução (mapping/reconstructProgress.ts)
 * rodou — por isso não faz parte do `ParsedShow` bruto.
 */

/** Sinal granular e ESPARSO — de watched_on_episode.csv/rewatched_episode.csv/seen_episode_latest.csv. Real, mas cobre só uma fração pequena das séries. Usado só pra desambiguação (candidato incompatível) e como checagem cruzada de confiança — nunca como fonte principal de progresso. */
export interface GranularEpisodeSignal {
  seasonNumber: number;
  episodeNumber: number;
}

export interface ParsedShow {
  tvTimeId: string;
  name: string;
  year: number | null;
  /** De user_tv_show_data.csv (nb_episodes_seen) — a fonte PRINCIPAL de progresso agora. */
  /** De user_tv_show_data.csv (nb_episodes_seen) — TASK-027J: valor BRUTO, exatamente como o TV Time exportou, incluindo reassistidas. Nunca usado direto pra decidir biblioteca/status — só como estatística de consumo, e como entrada pra calcular o episódio único (ver reconstructProgress.ts, uniqueEpisodesSeen = min(totalWatchEvents, totalKnownEpisodes)). */
  totalWatchEvents: number;
  /** De user_tv_show_data.csv (is_favorited). */
  isFavorite: boolean;
  /** De user_show_special_status.csv (status=for_later) — sinal EXPLÍCITO de "assistir depois", distinto de simplesmente ter 0 episódios vistos. */
  isExplicitlyForLater: boolean;
  /** Episódios específicos conhecidos com certeza (granular, esparso) — ver GranularEpisodeSignal. */
  knownEpisodes: GranularEpisodeSignal[];
}

export interface ParsedArchive {
  shows: ParsedShow[];
  favoriteCount: number;
  /** Arquivos esperados que não foram encontrados no zip — não impede a importação, só informa. */
  missingFiles: string[];
}

export type MatchStatus = "matched" | "ambiguous" | "not_found" | "resolved" | "skipped";

export interface ShowMatch {
  show: ParsedShow;
  status: MatchStatus;
  /** TMDB id, quando encontrado ou resolvido manualmente. */
  tmdbId: number | null;
  /** Opções encontradas na busca — só relevante quando `status` é "ambiguous" ou "not_found" (aí fica vazio ou com resultados fracos). */
  candidates: { tmdbId: number; title: string; year: number | null; posterPath: string | null; score: number }[];
  /** TASK-027K — informação que já era calculada em matchShow.ts (e só logada, nunca guardada) — carregada aqui pra a auditoria completa conseguir mostrar "score, motivo da escolha" por série, sem reprocessar nada. */
  matchScore?: number;
  matchedTitle?: string;
  matchReason?: string;
}

export type LibraryMergeStrategy = "merge" | "replace";

export interface ImportOptions {
  importLibrary: boolean;
  importEpisodes: boolean;
  restoreProgress: boolean;
  mergeStrategy: LibraryMergeStrategy;
}

export interface ImportSummary {
  importedShows: number;
  skippedShows: number;
  notFoundShows: number;
  importedEpisodes: number;
  elapsedSeconds: number;
  /** TASK-027B — séries com progresso reconstruído automaticamente que precisam de revisão (inconsistência entre nb_episodes_seen e o TMDB). Não bloqueiam a importação. */
  pendingReviewCount: number;
  /** TASK-027C — necessários para a auditoria comparar TV Time x SeenList. */
  completedShows: number;
  wantToWatchShows: number;
  watchingShows: number;
  favoritesImported: number;
  averageConfidence: number;
  /** TASK-166 — quantas séries (dentre as que precisavam da checagem, ou seja, não estavam em "assistir depois") ficaram sem dado de episódio ao vivo do TMDB pra confirmar "Assistindo" vs "Em dia" vs "Concluída" — mantidas com a categoria calculada só pela contagem bruta, sem a correção. Mostrado na tela pra não depender do usuário abrir o console (o modo de auditoria só existe em desenvolvimento). */
  liveTmdbUnavailableCount: number;
}
