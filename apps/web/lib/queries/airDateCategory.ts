export interface LiveEpisodeAirDate {
  seasonNumber: number;
  episodeNumber: number;
  airDate: string | null;
  /**
   * CORREÇÃO (2026-08-26 — "motor resistente a fusão de temporadas
   * pela TMDB", investigação Solo Leveling/Rent-a-Girlfriend/Dan Da
   * Dan/Kaiju No. 8) — ID PERMANENTE do episódio na TMDB. Opcional
   * só por compatibilidade com chamadores antigos; quando presente,
   * é a identidade preferencial pra decidir "assistido?" — sobrevive
   * a uma futura reestruturação de temporadas pela própria TMDB,
   * diferente de (seasonNumber, episodeNumber), que a TMDB pode
   * mudar (já mudou, para essas séries) sem aviso.
   */
  episodeId?: number;
}

/**
 * CORREÇÃO (2026-08-26 — "motor resistente") — um episódio conta
 * como assistido se o ID FIXO da TMDB estiver entre os assistidos
 * (`watchedEpisodeIds`) OU, quando esse ID ainda não foi gravado pra
 * aquela linha (dado antigo, de antes desta correção, ainda sem
 * backfill), pela chave (temporada-episódio) de sempre. Checar o ID
 * primeiro é o que resolve o bug: se a TMDB reagrupar temporadas de
 * novo no futuro, (seasonNumber, episodeNumber) do episódio muda,
 * mas o ID não — o episódio continua batendo como assistido.
 */
function episodeIsWatched(
  episode: { seasonNumber: number; episodeNumber: number; episodeId?: number },
  watchedEpisodeKeys: Set<string>,
  watchedEpisodeIds: Set<number>
): boolean {
  if (episode.episodeId !== undefined && watchedEpisodeIds.has(episode.episodeId)) return true;
  return watchedEpisodeKeys.has(`${episode.seasonNumber}-${episode.episodeNumber}`);
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
  /**
   * CORREÇÃO (bug real, investigado a fundo — Bleach, Re:Zero, Black
   * Clover e outras 2 séries presas em "Em dia" mesmo com episódio
   * pendente de verdade) — causa raiz bem mais profunda que qualquer
   * correção anterior desta função: `decideWatchingVsUpToDate` SEMPRE
   * comparou só TOTAIS (quantos assistidos no total vs. quantos já
   * saíram no total) — nunca conferiu se os episódios específicos
   * batem entre si. Uma importação bagunçada (TV Time, numeração
   * ABSOLUTA do anime inteiro despejada como se fosse uma única
   * "temporada 1", junto de uma reimportação posterior já separada
   * por temporada de verdade) deixou contagens de "assistido"
   * MULTIPLICADAS (Bleach: 769 linhas de episódio assistido gravadas
   * pra uma série que só tem 366 episódios reais) — o total sempre
   * "batia e sobrava" contra o total do TMDB, então a série ficava
   * "em dia" pra sempre, mesmo com um episódio específico (ex.: T02
   * E22) nunca de fato marcado.
   *
   * Corrigido comparando por IDENTIDADE (chave `temporada-episódio`,
   * mesmo formato já usado por `specialEpisodeKeys` e por
   * `findPendingEpisodes`/`isEpisodeWatched`, em
   * `ContinueWatchingCard.tsx`) em vez de contagem agregada — a
   * mesma lógica que o card de "Continue assistindo" já usava pra
   * decidir o que mostrar, agora também decide o STATUS gravado no
   * banco. Isso não depende de os dados estarem "limpos" — mesmo com
   * linhas duplicadas/malformadas de uma importação antiga, cada
   * episódio real do TMDB só conta como assistido se a chave exata
   * dele estiver entre os assistidos, nunca por coincidência de
   * total.
   */
  allNonSpecialEpisodesWatched: boolean;
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
  watchedEpisodeKeys: Set<string>,
  liveEpisodes: LiveEpisodeAirDate[],
  specialEpisodeKeys: Set<string> = new Set(),
  watchedEpisodeIds: Set<number> = new Set()
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

  // CORREÇÃO (ver comentário grande em `AirDateDecision.allNonSpecialEpisodesWatched`
  // acima — investigação do Bleach) — comparação por IDENTIDADE
  // (season-episode), não mais por total agregado. Um episódio só
  // conta como "assistido" se a chave exata dele estiver no Set —
  // imune a contagens infladas por importação duplicada/malformada.
  const unwatchedAired = airedByNow.filter((e) => !episodeIsWatched(e, watchedEpisodeKeys, watchedEpisodeIds));
  const hasUnwatchedAiredEpisode = unwatchedAired.length > 0;
  const allNonSpecialEpisodesWatched = nonSpecialLiveEpisodes.every((e) =>
    episodeIsWatched(e, watchedEpisodeKeys, watchedEpisodeIds)
  );

  if (hasUnwatchedAiredEpisode) {
    return {
      category: "watching",
      reason: `${unwatchedAired.length} episódio(s) já lançado(s) (air_date <= ${today}) ainda não assistido(s) — conferido episódio por episódio, não só por total.`,
      nonSpecialEpisodeCount: nonSpecialLiveEpisodes.length,
      allNonSpecialEpisodesWatched,
    };
  }
  return {
    category: "up_to_date",
    reason: `Todos os ${airedByNow.length} episódios já lançados até ${today} foram assistidos — conferido episódio por episódio, não só por total.`,
    nonSpecialEpisodeCount: nonSpecialLiveEpisodes.length,
    allNonSpecialEpisodesWatched,
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
  /**
   * CORREÇÃO (ver comentário grande em `AirDateDecision`, investigação
   * do Bleach) — antes era `watched: number` (um total agregado).
   * Agora é o conjunto de chaves `temporada-episódio` de fato
   * assistidas (mesmo formato de `specialEpisodeKeys`) — decisão de
   * status por identidade, não por contagem.
   */
  watchedEpisodeKeys: Set<string>;
  liveEpisodes: LiveEpisodeAirDate[];
  ended: boolean;
  specialEpisodeKeys?: Set<string>;
  /** Ver comentário em `episodeIsWatched`/`LiveEpisodeAirDate.episodeId` — "motor resistente" (2026-08-26). */
  watchedEpisodeIds?: Set<number>;
}

export type SeriesCategory = "watching" | "up_to_date" | "completed";

export interface SeriesCategoryResolution {
  category: SeriesCategory;
  reason: string;
}

export function resolveSeriesCategory(input: SeriesStatusInputs): SeriesCategoryResolution {
  const decision = decideWatchingVsUpToDate(
    input.watchedEpisodeKeys,
    input.liveEpisodes,
    input.specialEpisodeKeys ?? new Set(),
    input.watchedEpisodeIds ?? new Set()
  );

  if (input.ended && decision.allNonSpecialEpisodesWatched) {
    return {
      category: "completed",
      reason: `Série encerrada oficialmente e todos os ${decision.nonSpecialEpisodeCount} episódios principais (excluindo especiais) assistidos — conferido episódio por episódio.`,
    };
  }
  return { category: decision.category, reason: decision.reason };
}

/**
 * Decide se uma categoria recém-calculada deve ser GRAVADA, dado o
 * status ATUAL da série — único lugar que sabe as regras que
 * protegem decisão manual do usuário, pra qualquer um dos lugares
 * que gravam `series_status`:
 *
 * 1. "paused" nunca vira "watching" sozinho (bug real corrigido nesta
 *    auditoria — retomar uma série pausada é decisão manual).
 * 2. CORREÇÃO (2026-08-26, bug real reportado com prova — usuário
 *    marcou o Primal manualmente como "Assistir depois" depois de ver
 *    as temporadas antigas, rodou "Corrigir status das séries", e a
 *    série voltou pra "Assistindo" sozinha assim que saiu a Temporada
 *    3) — "want_to_watch" ganhou a MESMA proteção que "paused" já
 *    tinha: sair de "Assistir depois" não pode ser automático só
 *    porque saiu episódio novo (recálculo passivo, ninguém tocou na
 *    série).
 * 3. Categoria sem mudança só é regravada quando o resultado é
 *    "watching" (serve só pra atualizar `updated_at`, usado pra
 *    ordenar "Continue assistindo" — "up_to_date"/"completed" não
 *    têm nada pendente, não precisam subir no ranking à toa).
 *
 * BUG REAL CORRIGIDO (2026-09-03, reportado — "quando marco episódio
 * numa série que está em 'assistir depois', não muda pra 'assistindo'",
 * mais "não tem opção de retomar" — a 2ª queixa é CONSEQUÊNCIA da 1ª:
 * "Continue assistindo" só lista séries "watching"/"up_to_date", então
 * uma série presa em "want_to_watch" nunca aparece lá pra continuar) —
 * causa raiz: a regra #2 acima (adicionada pelo Primal) protege contra
 * o RECÁLCULO PASSIVO reviver sozinho uma série "want_to_watch" quando
 * sai episódio novo (ninguém tocou nela) — mas essa MESMA função
 * também é chamada depois que o usuário, de propósito, marca um
 * episódio como assistido (`recalculateSeriesCategoryAfterEpisodeChange`,
 * `seriesCategoryRecalc.ts`) — caso em que a promoção É o comportamento
 * certo (documentado desde a TASK-061, no mesmo arquivo: marcar
 * episódio É como uma série "want_to_watch" vira "watching", sem
 * precisar de um botão "Começar a assistir" à parte). O `return false`
 * daqui bloqueava os DOIS casos por igual, cancelando a TASK-061 pra
 * esse status específico sem ninguém ter decidido isso de propósito.
 *
 * `allowWantToWatchPromotion` (novo, default `false` — comportamento
 * de antes preservado pra quem não passar nada) deixa quem CHAMA dizer
 * qual dos dois casos é: `recalculateSeriesCategoryAfterEpisodeChange`
 * (ação explícita do usuário nesta série específica) passa `true`;
 * o recálculo em lote (`recalculateUpToDateSeriesCategories`, roda
 * sozinho ao abrir a Central de Séries) e a rota admin de reparo
 * continuam SEM passar nada (`false`), preservando a proteção contra
 * revivência automática que a correção do Primal pediu.
 */
export function shouldWriteSeriesCategory(
  currentStatus: string,
  newCategory: SeriesCategory,
  options?: { allowWantToWatchPromotion?: boolean }
): boolean {
  const allowWantToWatchPromotion = options?.allowWantToWatchPromotion ?? false;
  if (currentStatus === "paused" && newCategory === "watching") return false;
  if (currentStatus === "want_to_watch" && newCategory === "watching" && !allowWantToWatchPromotion) return false;
  return newCategory !== currentStatus || newCategory === "watching";
}
