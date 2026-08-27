/**
 * Tipos de domínio compartilhados entre apps/web e apps/mobile.
 *
 * São todos moldados pelo TMDB (busca, série, filme) — os tipos de
 * linha do banco (watched_episodes, movie_status) ficam perto de
 * onde são usados em apps/web/lib/queries, não aqui, porque são
 * detalhes de persistência, não domínio compartilhado entre apps.
 */
export type MediaType = "movie" | "series";

export interface MediaSearchResult {
  id: number;
  mediaType: MediaType;
  title: string;
  year: number | null;
  posterPath: string | null;
  /** A PEDIDO — refinamento da aba Sobre: card de "séries semelhantes" com nota, não só pôster+título. */
  voteAverage?: number;
  /** Só usado hoje pelo importador do TV Time, como critério de desempate entre candidatos com score parecido. */
  popularity?: number;
  /** Título original do TMDB (original_name/original_title) — usado pelo importador do TV Time pra comparar com o nome que o TV Time guarda, que costuma ser o original, não o localizado. */
  originalTitle?: string;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profilePath: string | null;
}

export interface Episode {
  id: number;
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  stillPath: string | null;
  runtimeMinutes: number | null;
  airDate: string | null;
}

export interface SeasonWithEpisodes {
  seasonNumber: number;
  name: string;
  episodes: Episode[];
}

export interface WatchProvider {
  id: number;
  name: string;
  logoPath: string | null;
}

export type MovieWatchStatus = "watched" | "want_to_watch" | "watching";

export interface MovieDetails {
  id: number;
  title: string;
  originalTitle: string;
  overview: string;
  backdropPath: string | null;
  posterPath: string | null;
  releaseDate: string | null;
  runtimeMinutes: number | null;
  genres: string[];
  voteAverage: number;
  /** A PEDIDO — mesmo refinamento já feito na série, agora em filme também. */
  trailerKey: string | null;
  director: string | null;
  cast: CastMember[];
  studios: string[];
  country: string | null;
  language: string | null;
  budget: number | null;
  revenue: number | null;
  watchProviders: WatchProvider[];
  similar: MediaSearchResult[];
}

export interface SeriesDetails {
  id: number;
  title: string;
  /** TASK-168 — melhor título pra comparar com fontes externas em inglês (MyAnimeList/Jikan), nunca exibido na tela — ver `pickTitleForExternalMatching` em lib/tmdb/client.ts. */
  matchTitle: string;
  overview: string;
  backdropPath: string | null;
  posterPath: string | null;
  firstAirDate: string | null;
  status: string;
  /**
   * CORREÇÃO (2026-08-26, bug real — Solo Leveling marcado como
   * "Concluída" mesmo com Temporada 3 já anunciada) — o campo `status`
   * da TMDB ("Ended"/"Canceled"/"Returning Series"...) é mantido por
   * pessoas e costuma ficar "atrasado": vira "Ended" assim que uma
   * temporada termina de exibir, mesmo depois de uma renovação já
   * anunciada — comum em anime. `inProduction` é um segundo sinal que
   * a própria TMDB já devolve de graça na mesma consulta (`/tv/{id}`),
   * mais confiável pra saber se ainda existe produção em andamento.
   * Usado junto com `status` (nunca sozinho) em qualquer lugar que
   * decide "a série encerrou de vez" — ver `getSeriesSummary`/
   * `getSeriesSeasonSummary` (lib/tmdb/client.ts) e
   * `computeSeriesCaughtUpBadge` (seriesCaughtUpBadge.ts, web e mobile).
   */
  inProduction: boolean;
  numberOfSeasons: number;
  numberOfEpisodes: number;
  genres: string[];
  networks: string[];
  voteAverage: number;
  /** A PEDIDO — refinamento da aba Sobre: "★ 4.8 • 183 mil avaliações" no hero. */
  voteCount: number;
  /** Chave do YouTube do trailer oficial mais recente, se o TMDB tiver um cadastrado. `null` quando não tem. */
  trailerKey: string | null;
  /** Até 8 imagens de cena (backdrops) — pra seção "Galeria". */
  gallery: string[];
  cast: CastMember[];
  /** A PEDIDO (2026-08-25) — "onde assistir" também pra série, não só filme/episódio. Reaproveita `getSeriesWatchProviders` (lib/tmdb/client.ts), que já existia (usado pela tela de Episódio) mas nunca tinha sido ligado à tela da série em si. */
  watchProviders: WatchProvider[];
  similar: MediaSearchResult[];
  seasons: SeasonWithEpisodes[];
}

// ---------------------------------------------------------------
// Biblioteca (TASK-007)
// ---------------------------------------------------------------

/** Vocabulário normalizado da Biblioteca — não é 1:1 com o enum bruto
 * de movie_status ('watched' vira 'completed' na leitura).
 * TASK-033 — "up_to_date" ("Em dia") virou status de verdade,
 * decidido e gravado pelo importador — deixou de ser um flag
 * calculado na leitura (ver LibraryItem.isCaughtUp, removido). */
export type LibraryStatus = "want_to_watch" | "watching" | "completed" | "paused" | "up_to_date";

export interface LibraryProgress {
  watchedEpisodes: number;
  totalEpisodes: number;
  /** TASK-027J — total de visualizações do TV Time (inclui reassistidas), separado de propósito de `watchedEpisodes` (episódios únicos). undefined quando a série nunca foi importada — nesse caso, estatísticas usam `watchedEpisodes` como substituto razoável (não existe conceito de reassistir fora da importação ainda). */
  totalWatchEvents?: number;
}

export interface LibraryItem {
  mediaType: MediaType;
  id: number;
  status: LibraryStatus;
  createdAt: string;
  updatedAt: string;
  /**
   * Data da atividade mais recente de verdade — pra filme, igual a
   * `updatedAt`. Pra série, é o mais recente entre `updatedAt` (só
   * muda quando a CATEGORIA muda, ex. Assistindo → Em dia) e a data
   * do episódio mais recente marcado (que muda a cada episódio,
   * mesmo sem trocar de categoria). Achado real (reportado): ordenar
   * por `updatedAt` puro fazia maratonar vários episódios seguidos
   * de uma série "Assistindo" não mover ela pra cima em lugar nenhum
   * — a categoria não mudava, então a data também não. Campo
   * separado de propósito: `updatedAt` continua servindo pra quem já
   * depende dele hoje (Central de Séries/Filmes), sem risco de
   * quebrar o que já funciona.
   */
  lastActivityAt: string;
  title: string;
  year: number | null;
  posterPath: string | null;
  /** Só filme. Formato TMDB (YYYY-MM-DD). Usado pra separar "Assistir depois" já lançado de "Em breve" (TASK-148). */
  releaseDate?: string | null;
  /** Só séries. */
  progress?: LibraryProgress;
  /** Filme: duração do filme. Série: duração média de um episódio. Minutos. */
  runtimeMinutes?: number;
  /**
   * ACHADO ("não tá suave" — placeholder cru "Série #123", 16ª rodada
   * de perf_measurements) — true enquanto o resumo do TMDB (pôster/
   * título/ano) ainda não voltou pra este item (renderização
   * progressiva, `onStatusRowsReady` em `library-state.ts`). Os
   * cards usam isso pra mostrar um skeleton/pulse discreto em vez do
   * fallback cru `Filme #123`/`Série #123` — sem esconder o
   * carregamento, só sem expor o ID interno. false/undefined quando
   * o resumo já resolveu, tenha vindo com pôster de verdade ou não
   * (aí sim é "sem pôster" de verdade, não mais "carregando").
   */
  summaryPending?: boolean;
}
