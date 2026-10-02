import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, getCurrentAuthUser } from "./supabase";
import type { Post, FeedScope } from "./posts";
import { fetchPosts } from "./posts";
import type { ActivityItem } from "./activityFeed";
import { fetchActivityFeed } from "./activityFeed";
import type { TrendingItem, FriendsWatchingItem } from "./trending";
import { fetchTrendingMedia, fetchFriendsWatching } from "./trending";
import { useTranslation } from "./i18n/LocaleProvider";

export interface ActivityGroup {
  userId: string;
  // Mais recente primeiro (mesma ordem de `activity` em `fetchFeedEntries` — ver `groupConsecutiveActivity`, abaixo). Identidade do usuário (nome/avatar/selo) vem de `items[0]` na UI — todos os itens são da MESMA pessoa, não precisa duplicar os campos aqui.
  items: ActivityItem[];
}

export type FeedEntry =
  | { kind: "post"; id: string; createdAt: string; post: Post }
  | { kind: "activity"; id: string; createdAt: string; activity: ActivityItem; heroEligible: boolean }
  | { kind: "activityGroup"; id: string; createdAt: string; group: ActivityGroup }
  | { kind: "trending"; id: string; createdAt: string; items: TrendingItem[] }
  | { kind: "friendsWatching"; id: string; createdAt: string; items: FriendsWatchingItem[] };

// Posição onde o módulo de "quebra de padrão" (em alta / amigos
// assistindo) é inserido na lista já ordenada — só uma vez por busca,
// e só se a lista for grande o bastante pra isso não parecer o feed
// inteiro, só módulo (documento de UX: "quebra o padrão do feed
// ocasionalmente", não no topo).
const PATTERN_BREAK_MIN_ENTRIES = 3;
const PATTERN_BREAK_INDEX = 5;

/**
 * THROTTLE DE HERO (2026-10-01, feedback de design explícito — "não
 * usaria o Hero apenas porque alguém terminou alguma coisa. Se houver
 * muitos finished, o feed vira uma sequência de banners enormes. Eu
 * limitaria, por exemplo, a um Hero a cada 5–7 itens, e os outros
 * finished usam uma versão compacta"). Faixa pedida foi um intervalo
 * (5-7), não um número fechado — escolhi o PONTO MÉDIO, 6, como gap
 * mínimo entre dois Heroes (1º "completed" da lista sempre é
 * elegível; o próximo só volta a ser elegível depois de, no mínimo,
 * `HERO_MIN_GAP` outras entradas desde o último Hero, contando TODAS
 * as entradas — não só as "completed" — porque "a cada 5-7 itens" se
 * referia ao Feed como um todo, não só às entradas de conclusão).
 * Reportando o número escolhido ao usuário de propósito (não é uma
 * decisão silenciosa) — fácil de ajustar se 6 não parecer certo na
 * prática.
 */
const HERO_MIN_GAP = 6;

/**
 * Busca o módulo de "quebra de padrão" certo pra cada aba — "Em alta"
 * (global) em "Para você", "Amigos assistindo" (só quem você segue)
 * em "Seguindo" — ver `lib/trending.ts`. Isolado num try/catch próprio
 * (não entra no `Promise.all` de posts+atividade): é um extra
 * decorativo, não o conteúdo principal do Feed — se falhar (rede,
 * RLS, o que for), o Feed continua funcionando normalmente sem o
 * módulo, em vez de a tela inteira cair por causa dele.
 */
async function fetchPatternBreakEntry(scope: FeedScope, locale: string): Promise<FeedEntry | null> {
  try {
    if (scope === "forYou") {
      const items = await fetchTrendingMedia(locale);
      if (items.length === 0) return null;
      return { kind: "trending", id: "pattern-break-trending", createdAt: new Date().toISOString(), items };
    } else {
      const items = await fetchFriendsWatching();
      if (items.length === 0) return null;
      return { kind: "friendsWatching", id: "pattern-break-friends-watching", createdAt: new Date().toISOString(), items };
    }
  } catch (error) {
    console.error("[useFeedEntries] Falha ao buscar módulo de quebra de padrão (ignorado)", error);
    return null;
  }
}

/**
 * BUG REAL CORRIGIDO (2026-10-01, reportado — mesma pessoa/mesmo
 * título aparecendo duas vezes no Feed, uma como post e outra como
 * card "avaliou") — quando a pessoa publica uma review no Feed
 * (`createReviewPost`, "Publicar também no Feed"), a MESMA avaliação
 * já teria gerado um card de atividade "avaliou" por conta própria
 * (`activityFeed.ts`, lendo a tabela `reviews`) — as duas fontes são
 * independentes (ver `syncReviewPostRating` em `lib/posts.ts`), mas o
 * usuário fez UMA ação só. O post (mais rico: tem o texto, curtida,
 * comentário) é quem fica; o card de atividade equivalente (mesmo
 * usuário + mesma mídia) é descartado. Compara só por autor+mídia —
 * não por data: um post publicado antes/depois da nota em si continua
 * sendo o mesmo evento aos olhos de quem vê o Feed.
 */
function dedupeReviewActivity(posts: Post[], activity: ActivityItem[]): ActivityItem[] {
  const reviewedKeys = new Set(
    posts.filter((p) => p.type === "review" && p.mediaType && p.mediaId != null).map((p) => `${p.userId}:${p.mediaType}:${p.mediaId}`)
  );
  return activity.filter((item) => !(item.activityType === "rated" && reviewedKeys.has(`${item.userId}:${item.mediaType}:${item.mediaId}`)));
}

/**
 * AGRUPAMENTO DE ATIVIDADE CONSECUTIVA (2026-10-01, reportado — print
 * mostrando a mesma pessoa dominando o Feed inteiro: "Camila" com 5
 * atividades automáticas seguidas, 8-9 min de diferença entre elas).
 * Pedido explícito: "quando o mesmo usuário fizer várias ações
 * semelhantes em uma janela curta... agrupe-as em um único activity
 * group". Só afeta atividade AUTOMÁTICA (`ActivityItem` — terminou/
 * avaliou/adicionou à lista); posts escritos de verdade (reviews com
 * texto, comentários) nunca entram aqui — já são um `kind: "post"`
 * separado, nem chegam nesta função.
 *
 * Algoritmo deliberadamente simples (pedido explícito: "não precisa
 * criar um sistema complexo") — `activity` já chega ordenada do mais
 * recente pro mais antigo (`fetchActivityFeed`/`dedupeReviewActivity`
 * preservam essa ordem). Varre a lista formando clusters: entra no
 * cluster atual quem for do MESMO usuário E tiver no máximo
 * `GROUP_WINDOW_MS` de distância do item anterior do cluster (não do
 * primeiro — "em cadeia", permite uma sequência mais longa que o
 * total do grupo ultrapasse a janela, desde que cada passo individual
 * esteja dentro dela). Cluster de 1 item só = devolve o item como
 * estava (passthrough, sem virar grupo); cluster de 2+ = vira
 * `ActivityGroup`. A renderização (ver `ActivityGroupCard.tsx`) decide
 * sozinha se mostra o resumo "mesmo tipo" ou o resumo "misto" — não
 * precisa de sub-divisão por tipo aqui, só o agrupamento por
 * usuário+tempo.
 */
const GROUP_WINDOW_MS = 15 * 60 * 1000;

function groupConsecutiveActivity(activity: ActivityItem[]): (ActivityItem | ActivityGroup)[] {
  const result: (ActivityItem | ActivityGroup)[] = [];
  let i = 0;
  while (i < activity.length) {
    const cluster: ActivityItem[] = [activity[i]];
    let j = i + 1;
    while (
      j < activity.length &&
      activity[j].userId === activity[i].userId &&
      new Date(cluster[cluster.length - 1].createdAt).getTime() - new Date(activity[j].createdAt).getTime() <= GROUP_WINDOW_MS
    ) {
      cluster.push(activity[j]);
      j++;
    }
    result.push(cluster.length >= 2 ? { userId: activity[i].userId, items: cluster } : cluster[0]);
    i = j;
  }
  return result;
}

function isActivityGroup(entry: ActivityItem | ActivityGroup): entry is ActivityGroup {
  return "items" in entry;
}

/**
 * Marca `heroEligible` nas entradas "completed", JÁ NA ORDEM FINAL do
 * Feed (depois do sort + inserção do módulo de quebra de padrão —
 * senão o "gap" contado aqui não corresponderia ao que a pessoa vê de
 * verdade na tela). 1ª entrada "completed" da lista sempre elegível;
 * as próximas só voltam a ser depois de `HERO_MIN_GAP` outras
 * entradas desde o último Hero concedido (ver comentário de
 * `HERO_MIN_GAP`, acima).
 */
function applyHeroThrottle(entries: FeedEntry[]): FeedEntry[] {
  let entriesSinceLastHero = Infinity; // garante que a 1ª "completed" da lista seja sempre elegível
  return entries.map((entry) => {
    if (entry.kind !== "activity" || entry.activity.activityType !== "completed") {
      entriesSinceLastHero++;
      return entry;
    }
    const heroEligible = entriesSinceLastHero >= HERO_MIN_GAP;
    entriesSinceLastHero = heroEligible ? 0 : entriesSinceLastHero + 1;
    return { ...entry, heroEligible };
  });
}

/**
 * CAMADA DE SELEÇÃO/RANKING (2026-10-01, a pedido — "quero chegar a
 * uma arquitetura simples onde as atividades/posts sejam primeiro
 * selecionados e ordenados por relevância e depois uma camada de
 * composição determine onde módulos especiais aparecem"). Primeira
 * versão era recência pura (extração sem mudar comportamento); esta
 * é a fórmula aprovada pelo usuário depois de diagnóstico + exemplo
 * numérico discutidos em conversa — pesos CONSERVADORES de propósito
 * (pedido explícito: "quero começar com pesos mais conservadores").
 *
 * score = recencyScore(idade) × socialMultiplier × typeMultiplier
 *
 *   recencyScore = decay exponencial contínuo (SEM faixas rígidas tipo
 *   <1h/<6h/<24h, pedido explícito) — `2^(-idadeHoras / HALF_LIFE_HOURS)`,
 *   cai pela metade a cada `HALF_LIFE_HOURS`. É o sinal PRINCIPAL —
 *   os outros dois são multiplicadores pequenos (1.10-1.15 no caso
 *   favorável, 0.95-1.0 no desfavorável), nunca o suficiente sozinhos
 *   pra inverter uma diferença de idade de várias horas (ver exemplos
 *   validados no final da implementação desta mudança).
 *
 *   socialMultiplier = BOOST, não filtro — conteúdo de quem o usuário
 *   segue ganha 1.15×; todo o resto continua aparecendo normalmente
 *   em 1×. `followedIds` só é buscado quando `scope === "forYou"` (ver
 *   `fetchFollowedIds`, abaixo) — na aba "Seguindo" TODO conteúdo já é
 *   de gente seguida, então o boost seria uniforme e não mudaria
 *   nenhuma ordem; buscar ali seria 1 query a mais sem efeito nenhum
 *   no resultado.
 *
 *   typeMultiplier = ajuste pequeno por tipo de ação: post/review com
 *   texto (1.10) > finished/rated (1.0, neutro — é o "meio do
 *   caminho") > watchlist (0.95). Um `activityGroup` é pontuado como
 *   UMA unidade (nunca desagrupado pra isso): usa o MAIOR
 *   `typeMultiplier` entre os itens do grupo — um grupo com pelo menos
 *   um "finished" não é penalizado por também ter um "watchlist"
 *   junto.
 *
 * `now` é capturado UMA VEZ no início de `rankEntries` (não
 * `Date.now()` por item) — junto com `createdAt`/`kind`/tipo/
 * `followedIds` (todos determinísticos), isso faz da função um
 * cálculo puro: mesmos dados + mesmo `now` = mesma ordem sempre.
 * Desempate final por `createdAt` desc, pros raríssimos casos de
 * score empatado exatamente.
 */
const HALF_LIFE_HOURS = 24;
const FOLLOWED_SOCIAL_MULTIPLIER = 1.15;
const TYPE_MULTIPLIER_POST = 1.1;
const TYPE_MULTIPLIER_COMPLETED = 1.0;
const TYPE_MULTIPLIER_RATED = 1.0;
const TYPE_MULTIPLIER_WATCHLIST = 0.95;

function activityTypeMultiplier(activityType: ActivityItem["activityType"]): number {
  switch (activityType) {
    case "completed":
      return TYPE_MULTIPLIER_COMPLETED;
    case "rated":
      return TYPE_MULTIPLIER_RATED;
    case "watchlist":
      return TYPE_MULTIPLIER_WATCHLIST;
    default:
      // Defensivo — `ActivityType` só tem esses 3 valores hoje; nunca deveria cair aqui.
      return TYPE_MULTIPLIER_WATCHLIST;
  }
}

function entryAuthorId(entry: FeedEntry): string | null {
  if (entry.kind === "post") return entry.post.userId;
  if (entry.kind === "activity") return entry.activity.userId;
  if (entry.kind === "activityGroup") return entry.group.userId;
  return null; // "trending"/"friendsWatching" não têm autor — nunca passam por `rankEntries` hoje (só `composeFeed` os insere depois), fica defensivo mesmo assim.
}

function entryTypeMultiplier(entry: FeedEntry): number {
  if (entry.kind === "post") return TYPE_MULTIPLIER_POST;
  if (entry.kind === "activity") return activityTypeMultiplier(entry.activity.activityType);
  if (entry.kind === "activityGroup") return Math.max(...entry.group.items.map((item) => activityTypeMultiplier(item.activityType)));
  return 1;
}

function recencyScore(createdAt: string, nowMs: number): number {
  const ageHours = (nowMs - new Date(createdAt).getTime()) / (1000 * 60 * 60);
  return Math.pow(2, -ageHours / HALF_LIFE_HOURS);
}

function rankEntries(entries: FeedEntry[], followedIds: Set<string>): FeedEntry[] {
  const nowMs = Date.now(); // capturado uma única vez — todo o ranking usa esta mesma referência de "agora".
  const scored = entries.map((entry) => {
    const authorId = entryAuthorId(entry);
    const social = authorId && followedIds.has(authorId) ? FOLLOWED_SOCIAL_MULTIPLIER : 1;
    const score = recencyScore(entry.createdAt, nowMs) * social * entryTypeMultiplier(entry);
    return { entry, score };
  });
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return new Date(b.entry.createdAt).getTime() - new Date(a.entry.createdAt).getTime(); // desempate final, pedido explícito
  });
  return scored.map((s) => s.entry);
}

/**
 * BUSCA MÍNIMA DE `followedIds` (2026-10-01, originalmente só pro
 * ranking — ver comentário grande de `rankEntries`, acima). Mesmo
 * padrão de query já usado em `posts.ts`/`activityFeed.ts`/
 * `trending.ts` (nenhum arquivo exportava isso como função
 * reaproveitável, então esta é nova, mas a CONSULTA em si — `follows`
 * filtrado por `follower_id` — já existia de sobra no app; não é uma
 * tabela nova nem uma query mais pesada que as que já existem).
 * Isolada em try/catch próprio, igual a `fetchPatternBreakEntry` — é
 * um sinal SECUNDÁRIO do ranking (boost, não filtro): se falhar, o
 * ranking simplesmente usa social=1× pra todo mundo (equivalente a
 * ninguém seguido), em vez de quebrar o Feed inteiro por causa disso.
 *
 * EXPORTADA (2026-10-01, a pedido — reaproveitada pelo filtro do
 * Realtime de `realtime-feed-new-activity` em `app/(tabs)/feed.tsx`
 * pra saber quem o usuário segue na aba "Seguindo", sem duplicar esta
 * consulta).
 */
export async function fetchFollowedIds(): Promise<Set<string>> {
  try {
    const {
      data: { user },
    } = await getCurrentAuthUser();
    if (!user) return new Set();
    const { data, error } = await supabase.from("follows").select("following_id").eq("follower_id", user.id);
    if (error) throw error;
    return new Set((data ?? []).map((r) => r.following_id as string));
  } catch (error) {
    console.error("[useFeedEntries] Falha ao buscar quem o usuário segue (ignorado — ranking usa boost social 1× pra todos)", error);
    return new Set();
  }
}

/**
 * CAMADA DE COMPOSIÇÃO (2026-10-01, mesmo pedido acima) — extração
 * PURA do `splice` que já existia, sem mudar comportamento (decisão
 * explícita: manter "1 módulo especial, índice fixo" por enquanto —
 * generalizar pra módulos recorrentes fica pra uma mudança separada,
 * combinada à parte). Ponto de extensão nomeado: quem decide ONDE/
 * QUANTAS VEZES um módulo especial aparece é só esta função — mudar
 * essa regra depois não precisa tocar em `rankEntries` nem no resto
 * do pipeline.
 */
function composeFeed(ranked: FeedEntry[], specialModule: FeedEntry | null): FeedEntry[] {
  if (!specialModule || ranked.length < PATTERN_BREAK_MIN_ENTRIES) return ranked;
  const composed = [...ranked];
  const insertAt = Math.min(PATTERN_BREAK_INDEX, composed.length);
  composed.splice(insertAt, 0, specialModule);
  return composed;
}

/**
 * ISOLAMENTO DE FALHA ENTRE AS 2 FONTES PRINCIPAIS (2026-10-01, auditoria
 * funcional, achado Médio — "`fetchFeedEntries` usa `Promise.all` com
 * `fetchPosts`/`fetchActivityFeed`; se só uma falhar, o Feed inteiro cai
 * em `PageError`, mesmo a outra tendo retornado normalmente"). Mesmo
 * padrão já usado por `fetchPatternBreakEntry`/`fetchFollowedIds`, acima
 * — tenta, loga qual fonte falhou, nunca deixa a exceção subir sozinha —
 * só que aqui devolvendo `null` em vez de `[]`/`new Set()`: as duas
 * fontes já têm casos legítimos de resposta vazia (ninguém seguido
 * ainda, sem posts/atividade no período) e `[]` continua significando
 * exatamente isso, sem mudança nenhuma — `null` é o único jeito de dizer
 * "a fonte falhou" sem reaproveitar um valor que já tinha outro
 * significado. Deliberadamente NÃO mexe em `fetchPosts`/
 * `fetchActivityFeed` em si (continuam lançando normalmente pra quem
 * mais as chama, ex. `usePosts.ts`) — o isolamento é só aqui, no ponto
 * de composição do Feed.
 */
async function fetchPostsSafe(scope: FeedScope): Promise<Post[] | null> {
  try {
    return await fetchPosts(scope);
  } catch (error) {
    console.error("[useFeedEntries] Falha ao buscar POSTS do Feed — Feed continua com a atividade automática, se essa 2ª fonte funcionar", error);
    return null;
  }
}

async function fetchActivityFeedSafe(scope: FeedScope, locale: string): Promise<ActivityItem[] | null> {
  try {
    return await fetchActivityFeed(scope, locale);
  } catch (error) {
    console.error("[useFeedEntries] Falha ao buscar ATIVIDADE AUTOMÁTICA do Feed — Feed continua com os posts, se essa 2ª fonte funcionar", error);
    return null;
  }
}

async function fetchFeedEntries(scope: FeedScope, locale: string): Promise<{ entries: FeedEntry[]; hadPartialFailure: boolean }> {
  // `followedIds` só é buscado em "forYou" — ver comentário grande de
  // `rankEntries`, acima: em "following" todo conteúdo já é de gente
  // seguida, o boost social seria uniforme (1.15× pra tudo) e NÃO
  // mudaria ordem nenhuma — só custaria 1 query extra sem efeito
  // nenhum no resultado. `Promise.resolve(new Set())` mantém o mesmo
  // formato de `Promise.all` abaixo sem ramificar a função em dois
  // caminhos.
  const [postsOrNull, rawActivityOrNull, patternBreak, followedIds] = await Promise.all([
    fetchPostsSafe(scope),
    fetchActivityFeedSafe(scope, locale),
    fetchPatternBreakEntry(scope, locale),
    scope === "forYou" ? fetchFollowedIds() : Promise.resolve(new Set<string>()),
  ]);

  // AS DUAS FALHARAM — não tem o que mostrar; relança pra cair no MESMO
  // `catch`/`setIsError(true)` que `load()` já tinha antes desta mudança
  // (ver comentário grande de `load`, abaixo) — nenhum sistema de erro
  // novo, só preserva o `PageError` pro caso em que ele já fazia sentido.
  if (postsOrNull === null && rawActivityOrNull === null) {
    throw new Error("[useFeedEntries] Falha ao buscar as duas fontes do Feed (posts e atividade) — ver os 2 erros individuais logados acima.");
  }

  const hadPartialFailure = postsOrNull === null || rawActivityOrNull === null;
  const posts = postsOrNull ?? [];
  const rawActivity = rawActivityOrNull ?? [];

  const dedupedActivity = dedupeReviewActivity(posts, rawActivity);
  const groupedActivity = groupConsecutiveActivity(dedupedActivity);

  const entries: FeedEntry[] = [
    ...posts.map((post): FeedEntry => ({ kind: "post", id: `post-${post.id}`, createdAt: post.createdAt, post })),
    ...groupedActivity.map((entry): FeedEntry =>
      isActivityGroup(entry)
        ? { kind: "activityGroup", id: `activity-group-${entry.userId}-${entry.items[0].id}`, createdAt: entry.items[0].createdAt, group: entry }
        : { kind: "activity", id: `activity-${entry.id}`, createdAt: entry.createdAt, activity: entry, heroEligible: false }
    ),
  ];

  const ranked = rankEntries(entries, followedIds);
  const composed = composeFeed(ranked, patternBreak);

  // `applyHeroThrottle` só examina `kind: "activity"` — uma atividade
  // dentro de um grupo (`kind: "activityGroup"`) nunca passa por ali,
  // então nunca vira Hero (pedido explícito: "não usaria Hero card
  // quando isso acontecer... Hero deveria aparecer quando uma
  // atividade ISOLADA merece destaque"). Continua sendo a ÚLTIMA
  // passada de propósito — sua semântica ("N entradas desde o último
  // Hero") só faz sentido sobre a ordem final já composta.
  return { entries: applyHeroThrottle(composed), hadPartialFailure };
}

/**
 * ATIVIDADE NO FEED (2026-10-01, documento de UX — "o Feed parece
 * estático", prioridade escolhida: Activity Cards) — `usePosts.ts`
 * sozinho só buscava posts escritos; esta é a versão que o Feed usa
 * de verdade agora, combinando posts (`lib/posts.ts`) com atividade
 * automática (terminou série/filme, avaliou, adicionou à watchlist —
 * `lib/activityFeed.ts`) numa lista só, intercalada por data.
 *
 * MESMO padrão de cache por aba já usado em `usePosts.ts` (ver o
 * comentário grande lá, "toda vez que passo de aba, recarrega") — só
 * que a chave do cache aqui é `scope:locale` (não só `scope`), porque
 * `fetchActivityFeed` busca os títulos no idioma atual — trocar de
 * idioma precisa buscar de novo, trocar de aba no MESMO idioma não.
 */
export function useFeedEntries(scope: FeedScope = "forYou") {
  const { locale } = useTranslation();
  const cacheKey = `${scope}:${locale}`;
  const cacheRef = useRef<Map<string, FeedEntry[]>>(new Map());
  const keyRef = useRef(cacheKey);

  const [entries, setEntries] = useState<FeedEntry[] | null>(() => cacheRef.current.get(cacheKey) ?? null);
  const [isLoading, setIsLoading] = useState(() => !cacheRef.current.has(cacheKey));
  const [isError, setIsError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * RETORNA SUCESSO/FALHA (2026-10-01, a pedido — "se `refetch()`
   * falhar, não faça scroll para o topo como se novos dados tivessem
   * sido carregados") — antes `load` não devolvia nada ao chamador;
   * `refetch()` (abaixo) só repassa o retorno de `load`, então quem
   * chama `refetch()` em `feed.tsx` passa a saber, pelo valor
   * resolvido da própria Promise, se os dados realmente chegaram —
   * sem precisar ler `isError` (que é state assíncrono — o fechamento
   * de uma função chamada antes do rerender seguinte ainda veria o
   * valor antigo) nem criar nenhum sistema de erro novo: continua
   * sendo o MESMO catch/`setIsError(true)` de sempre, só que agora
   * ele também devolve `false` pra quem está esperando a Promise.
   *
   * FALHA PARCIAL NÃO É `isError` (2026-10-01, achado Médio da
   * auditoria, ver `fetchFeedEntries`/`fetchPostsSafe`/
   * `fetchActivityFeedSafe`, acima) — `isError`/`PageError` continuam
   * reservados pro caso em que NENHUMA fonte trouxe nada (`fetchFeedEntries`
   * relança nesse caso só, é o único jeito de chegar neste `catch`
   * agora). Falha parcial atualiza `entries` normalmente com o que
   * funcionou (`setEntries(data.entries)`, igual sucesso total) — o
   * Feed continua utilizável — mas o booleano devolvido pra quem chamou
   * `load`/`refetch` é `false` mesmo assim: é o mesmo sinal que
   * `handleShowNewContent` (`feed.tsx`) já usa pra decidir se limpa
   * "↑ Novidades" e rola a tela — uma falha parcial não pode limpar o
   * indicador, porque a novidade sinalizada pelo Realtime pode estar
   * justamente na fonte que falhou agora.
   */
  const load = useCallback(
    async (isRefresh: boolean, targetKey: string, targetScope: FeedScope, targetLocale: string): Promise<boolean> => {
      if (isRefresh) setRefreshing(true);
      else setIsLoading(true);
      setIsError(false);

      try {
        const data = await fetchFeedEntries(targetScope, targetLocale);
        cacheRef.current.set(targetKey, data.entries);
        if (keyRef.current === targetKey) setEntries(data.entries);
        return !data.hadPartialFailure;
      } catch (error) {
        console.error("[useFeedEntries] Falha ao buscar feed (as duas fontes falharam)", error);
        if (keyRef.current === targetKey) setIsError(true);
        return false;
      } finally {
        if (keyRef.current === targetKey) {
          if (isRefresh) setRefreshing(false);
          else setIsLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    keyRef.current = cacheKey;
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      // Já visto nesta sessão (mesma aba + idioma) — troca na hora.
      setEntries(cached);
      setIsLoading(false);
      setIsError(false);
    } else {
      setEntries(null);
      load(false, cacheKey, scope, locale);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `scope`/`locale` já estão representados em `cacheKey`
  }, [cacheKey, load]);

  const refetch = useCallback(() => load(true, keyRef.current, scope, locale), [load, scope, locale]);

  return { entries, isLoading, isError, refreshing, refetch };
}
