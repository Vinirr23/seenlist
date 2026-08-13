export interface LiveEpisodeAirDate {
  seasonNumber: number;
  episodeNumber: number;
  airDate: string | null;
}

export interface AirDateDecision {
  category: "watching" | "up_to_date";
  reason: string;
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
    };
  }
  return {
    category: "up_to_date",
    reason: `Todos os ${airedByNow.length} episódios já lançados até ${today} foram assistidos.`,
  };
}
