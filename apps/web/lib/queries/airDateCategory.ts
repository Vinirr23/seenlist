export interface LiveEpisodeAirDate {
  seasonNumber: number;
  episodeNumber: number;
  airDate: string | null;
}

export interface AirDateDecision {
  category: "watching" | "up_to_date";
  reason: string;
  /**
   * CORREÇÃO (bug real, reportado — rodar "Corrigir status das
   * séries" jogou VÁRIAS séries terminadas/em dia de volta pra
   * "Assistindo") — causa raiz encontrada: todo mundo que chama esta
   * função (recalculateUpToDateSeriesCategories,
   * recalculateSeriesCategoryAfterEpisodeChange, e a rota admin
   * equivalente) decidia "já assistiu tudo?" (`allEpisodesWatched`,
   * pra promover a "completed") comparando contra
   * `liveEpisodes.length` BRUTO — incluindo episódios que o TV Time
   * marcou como "especiais" (`is_special = true`, ver migration
   * `20260729000000_watched_episodes_is_special.sql`: "89 episódios
   * reais... especiais DENTRO de temporadas normais", não só
   * temporada 0 — esses já são excluídos de `getAllEpisodesWithAirDates`
   * mas os especiais DENTRO de temporada >=1 continuam na lista do
   * TMDB). Episódio especial é gravado com `is_special = true`, e toda
   * contagem de "assistidos" (`watched`) exclui esses
   * (`.eq("is_special", false)`) — só que ningúem excluía o mesmo
   * episódio do lado do TMDB. Resultado: série com QUALQUER episódio
   * especial dentro de temporada normal nunca conseguia "bater" a
   * conta (watched sempre < total do TMDB), então NUNCA virava
   * "completed"/"up_to_date" — caía sempre em "watching", mesmo com
   * todo episódio de verdade assistido.
   *
   * O parâmetro `specialEpisodeKeys` já existia nesta função
   * exatamente pra resolver isso (documentado na migration: "toda
   * consulta de PROGRESSO/BIBLIOTECA passa a excluir is_special = true
   * explicitamente") — mas NENHUM dos 3 lugares que chamam esta
   * função jamais passava esse argumento (conferido por busca no
   * código inteiro), então na prática sempre valia o padrão (Set
   * vazio) e nunca excluía nada. Devolver `nonSpecialEpisodeCount`
   * aqui (em vez de cada chamador duplicar o mesmo filtro) garante
   * que TODOS os lugares que decidem "completed" usem exatamente a
   * mesma contagem, já sem os especiais — fonte única da verdade.
   */
  nonSpecialEpisodeCount: number;
}

/**
 * TASK-043 — extraído da lógica de importação (TASK-042) pra ser
 * reutilizado fora dela também. Achado real: marcar episódio direto
 * na tela (fora da importação) nunca recalculava categoria nenhuma —
 * só a importação decidia "Assistindo" vs "Em dia", então séries que
 * o usuário terminava de assistir manualmente (Rancho Dutton,
 * Demolidor, Dexter) ficavam presas em "Assistindo" pra sempre.
 *
 * Só decide entre os dois — quem chama decide SE essa distinção se
 * aplica. TASK-061: agora também é chamada pra séries em
 * "want_to_watch" (promoção no primeiro episódio marcado) — só
 * "paused" continua de fora, por ser decisão explícita do usuário.
 */
export function decideWatchingVsUpToDate(
  mainEpisodesWatched: number,
  liveEpisodes: LiveEpisodeAirDate[],
  specialEpisodeKeys: Set<string> = new Set()
): AirDateDecision {
  const nonSpecialLiveEpisodes = liveEpisodes.filter(
    (e) => !specialEpisodeKeys.has(`${e.seasonNumber}-${e.episodeNumber}`)
  );
  /*
   * CORREÇÃO (a pedido — Re:Zero preso em up_to_date há mais de um
   * mês, mesmo com episódio novo saindo) — dois ajustes juntos,
   * achados comparando com o mobile (`todayLocalKey()`,
   * `nextEpisodeToWatch.ts`):
   *
   * 1. "Hoje" agora é fuso LOCAL, não UTC (`new Date().toISOString()`
   *    calcula em UTC — pra quem está no Brasil, isso diverge todo dia
   *    das 21h à meia-noite, mesma classe de bug já documentada e
   *    corrigida no mobile em `lib/localDate.ts`).
   * 2. `airDate === null` não exclui mais um episódio da contagem —
   *    mesmo padrão já corrigido em TRÊS outros lugares nesta sessão
   *    (`ContinueWatchingCard.tsx`, `nextEpisodeToWatch.ts` mobile,
   *    `check-new-releases`), só que esta função específica — a que
   *    decide "watching" vs "up_to_date" pra série já catalogada —
   *    tinha ficado de fora daquela rodada. TMDB às vezes demora a
   *    preencher a data do episódio mais recente — o episódio já
   *    saiu de verdade, só a data ainda não chegou na API.
   *
   * CORREÇÃO 3 (bug NOVO, introduzido pela correção 2 acima —
   * reportado "temporada nova confirmada mas SEM data de lançamento
   * foi pra Continue assistindo à toa") — tratar todo `airDate: null`
   * como "já saiu" também captura o caso OPOSTO: temporada anunciada
   * sem nenhuma previsão de estreia (não confundir com "TMDB atrasado
   * pra atualizar episódio que JÁ saiu" — são duas coisas diferentes,
   * as duas com `airDate: null`).
   *
   * A distinção certa: um episódio sem data só conta como "já saiu"
   * se EXISTIR pelo menos um outro episódio da MESMA temporada com
   * data confirmada e já passada — sinal de que a temporada já
   * começou a ir ao ar de verdade, e é só ESSE episódio específico
   * que o TMDB ainda não atualizou. Temporada inteira sem nenhuma
   * data (especulação de futuro) não conta mais.
   */
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const seasonsWithConfirmedAiring = new Set(
    nonSpecialLiveEpisodes.filter((e) => e.airDate !== null && e.airDate <= today).map((e) => e.seasonNumber)
  );
  const airedByNow = nonSpecialLiveEpisodes.filter(
    (e) => (e.airDate !== null && e.airDate <= today) || (e.airDate === null && seasonsWithConfirmedAiring.has(e.seasonNumber))
  );
  const hasUnwatchedAiredEpisode = mainEpisodesWatched < airedByNow.length;

  if (hasUnwatchedAiredEpisode) {
    return {
      category: "watching",
      reason: `${airedByNow.length - mainEpisodesWatched} episódio(s) já lançado(s) (air_date <= ${today}) ainda não assistido(s).`,
      nonSpecialEpisodeCount: nonSpecialLiveEpisodes.length,
    };
  }
  return {
    category: "up_to_date",
    reason: `Todos os ${airedByNow.length} episódios já lançados até ${today} foram assistidos.`,
    nonSpecialEpisodeCount: nonSpecialLiveEpisodes.length,
  };
}

/**
 * UNIFICAÇÃO (a pedido explícito — "unifique agora por app, não quero
 * voltar a isso mais") — até aqui, a sequência "decide watching/
 * up_to_date, então promove pra completed se a série terminou e
 * bateu a conta" estava copiada, à mão, em 3 lugares diferentes só no
 * web (`recalculateUpToDateSeriesCategories`,
 * `recalculateSeriesCategoryAfterEpisodeChange`, e a rota admin) —
 * foi exatamente essa duplicação que permitiu o bug dos especiais
 * ficar corrigido em uns lugares e não em outros. `resolveSeriesCategory`
 * é agora a ÚNICA função que qualquer um desses 3 lugares deve chamar
 * pra essa decisão — eles não recalculam mais nada por conta própria.
 *
 * Note que a importação do TV Time (`lib/tvtime-migration/category.ts`)
 * NÃO usa esta função — ela tem uma necessidade genuinamente
 * diferente (fallback pra `mainEpisodesTotal` quando `liveEpisodes`
 * ainda não foi buscado, e mapeamento direto de status do CSV pra
 * quem não é elegível pra recálculo) e já estava correta quanto aos
 * especiais desde a origem (TASK-043 extraiu `decideWatchingVsUpToDate`
 * DE LÁ pra reuso, não o contrário) — forçá-la nesta mesma função
 * arriscaria quebrar esse fallback sem nenhum ganho real, já que ela
 * nunca foi a fonte do bug de duplicação.
 */
export interface SeriesStatusInputs {
  watched: number;
  liveEpisodes: LiveEpisodeAirDate[];
  ended: boolean;
  specialEpisodeKeys?: Set<string>;
}

export type SeriesCategory = "watching" | "up_to_date" | "completed";

export interface SeriesCategoryResolution {
  category: SeriesCategory;
  reason: string;
}

export function resolveSeriesCategory(input: SeriesStatusInputs): SeriesCategoryResolution {
  const decision = decideWatchingVsUpToDate(input.watched, input.liveEpisodes, input.specialEpisodeKeys ?? new Set());
  const allEpisodesWatched = input.watched >= decision.nonSpecialEpisodeCount;

  if (input.ended && allEpisodesWatched) {
    return {
      category: "completed",
      reason: `Série encerrada oficialmente e todos os ${decision.nonSpecialEpisodeCount} episódios principais (excluindo especiais) assistidos.`,
    };
  }
  return { category: decision.category, reason: decision.reason };
}

/**
 * Decide se uma categoria recém-calculada deve ser GRAVADA, dado o
 * status ATUAL da série — único lugar que sabe as duas regras que
 * protegem decisão manual do usuário, pra qualquer um dos 3 lugares
 * que gravam `series_status`:
 *
 * 1. "paused" nunca vira "watching" sozinho (bug real corrigido nesta
 *    auditoria — retomar uma série pausada é decisão manual).
 * 2. Categoria sem mudança só é regravada quando o resultado é
 *    "watching" (serve só pra atualizar `updated_at`, usado pra
 *    ordenar "Continue assistindo" — "up_to_date"/"completed" não
 *    têm nada pendente, não precisam subir no ranking à toa).
 */
export function shouldWriteSeriesCategory(currentStatus: string, newCategory: SeriesCategory): boolean {
  if (currentStatus === "paused" && newCategory === "watching") return false;
  return newCategory !== currentStatus || newCategory === "watching";
}
