import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase, getCurrentAuthUser } from "./supabase";
import { useAuth } from "./auth/AuthProvider";
import type { Post, FeedScope } from "./posts";
import { fetchPosts } from "./posts";
import type { ActivityItem, ActivityRawData } from "./activityFeed";
import { fetchActivityRawData, buildActivityItems } from "./activityFeed";
import type { TrendingItem, FriendsWatchingItem, TrendingRawData, FriendsWatchingRawData } from "./trending";
import { fetchTrendingRawData, buildTrendingItems, fetchFriendsWatchingRawData, buildFriendsWatchingItems } from "./trending";
import { fetchDisplaySummariesCached, type MediaSummary } from "./library";
import { useTranslation } from "./i18n/LocaleProvider";

export interface ActivityGroup {
  userId: string;
  // Mais recente primeiro (mesma ordem de `activity` em `fetchFeedEntries` — ver `groupConsecutiveActivity`, abaixo). Identidade do usuário (nome/avatar/selo) vem de `items[0]` na UI — todos os itens são da MESMA pessoa, não precisa duplicar os campos aqui.
  //
  // PODE TER `MergedActivityItem` MISTURADO (2026-10-06, bug real
  // reportado com print — "Legítimo Rei" e "Cruzada" aparecendo 2x
  // cada dentro do mesmo grupo misto, 1 pôster por ação crua) — ver
  // comentário grande de `collapseSameMediaItems`, abaixo, pra causa
  // raiz completa. Antes desta correção, `items` só tinha
  // `ActivityItem` cru; agora, quando 2+ itens do cluster misto
  // compartilham o MESMO título, eles chegam aqui já fundidos num
  // `MergedActivityItem` (mesmo tipo usado por `activityMulti`) —
  // 1 entrada por título, sempre.
  items: (ActivityItem | MergedActivityItem)[];
}

/**
 * MESMO TÍTULO, VÁRIAS AÇÕES (2026-10-02, reportado com print — "terminar
 * e avaliar o título duplica o poster dele, quando deveria aparecer tipo
 * um hero e as ações") — ver comentário grande de `groupConsecutiveActivity`,
 * abaixo, pra causa raiz completa. Representa o caso em que um cluster de
 * atividade consecutiva (mesmo usuário, mesma janela de tempo) é sobre
 * UM ÚNICO título (ex.: "terminou" + "avaliou" a mesma série em sequência)
 * — em vez de virar um `ActivityGroup` (grade de pôsteres, pensada pra
 * TÍTULOS DIFERENTES), essas ações se fundem num item só, com a lista de
 * ações ordenada cronologicamente (mais antiga primeiro — ordem em que
 * aconteceram de verdade).
 */
export interface MergedActivityItem {
  // Junção dos ids originais (ex.: "abc+def") — só usado pra formar a key/id da entrada no Feed, não é um id de linha real em nenhuma tabela.
  id: string;
  userId: string;
  userName: string;
  userUsername: string;
  userAvatarUrl: string | null;
  userVerifiedTier: ActivityItem["userVerifiedTier"];
  mediaType: "movie" | "series";
  mediaId: number;
  mediaTitle: string;
  mediaPosterPath: string | null;
  // Ação mais recente das duas (mesmo critério de `createdAt` usado pro resto do Feed/ranking).
  createdAt: string;
  actions: ActivityItem["activityType"][];
  // Nota de uma das ações, se "rated" estiver entre `actions` — `null` senão.
  rating: number | null;
}

export type FeedEntry =
  | { kind: "post"; id: string; createdAt: string; post: Post }
  | { kind: "activity"; id: string; createdAt: string; activity: ActivityItem; heroEligible: boolean }
  | { kind: "activityGroup"; id: string; createdAt: string; group: ActivityGroup }
  | { kind: "activityMulti"; id: string; createdAt: string; item: MergedActivityItem }
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
 * THROTTLE DE HERO — ERA posicional, virou hash determinístico
 * (2026-10-06, bug real reportado com prints — "Código: Vingança" era
 * Hero, assisti "A Revolta", "A Revolta" virou Hero e "Código:
 * Vingança" voltou a card normal).
 *
 * CAUSA RAIZ (investigada a fundo antes de mexer): a versão antiga
 * contava "quantas entradas se passaram desde o último Hero" andando
 * pela lista final, na ORDEM DE EXIBIÇÃO daquela chamada específica.
 * Toda vez que o Feed recarrega (pull-to-refresh, criar post, tocar
 * em "↑ Novidades", etc.) o pipeline inteiro roda nascer — `rankEntries`
 * resorteia por recência a partir de um `Date.now()` novo — e uma
 * atividade nova de alguém, nascendo perto do topo, empurra tudo que
 * vinha depois uma posição adiante. Isso reseta a contagem de gap no
 * meio da lista, e um Hero antigo que não tinha mudado em nada podia
 * reprovar o `>= HERO_MIN_GAP` só por ter mudado de posição.
 *
 * NOVA REGRA — função PURA de `activity.id` (hash determinístico,
 * `hashActivityId`, abaixo): mesma activity, mesma decisão, sempre,
 * não importa o que entrou/saiu/mudou de posição ao redor dela. Isso
 * era inegociável (ver `heroEligible` em `applyHeroThrottle`, abaixo)
 * — o preço é que o espaçamento entre Heroes deixa de ser GARANTIDO
 * (era, antes) e passa a ser só uma MÉDIA estatística; dois Heroes
 * raramente podem ficar vizinhos (aceito de propósito, pedido
 * explícito — "se dois Heroes ocasionalmente ficarem próximos,
 * aceitamos isso em troca da estabilidade").
 *
 * CALIBRAÇÃO (dados reais, não chute) — pedido original de design era
 * ~1 Hero a cada 5-7 ENTRADAS TOTAIS do Feed (não só "completed"), um
 * intervalo com 6 de ponto médio. Só que o hash roda só sobre
 * completed ISOLADAS elegíveis — uma fração menor do total — então
 * `1/6` de probabilidade ali NÃO equivale a "1 a cada 6 entradas do
 * Feed". Medi em cima de uma exportação real do banco (series_status +
 * movie_status + reviews + posts, dedupe + agrupamento de 15min
 * aplicados exatamente como em produção): das 435 entradas finais do
 * histórico exportado, 153 são completed isoladas elegíveis — fração
 * `f ≈ 0.3517`. Probabilidade derivada: `p = 1 / (6 × f) ≈ 0.4739`.
 * Simulando os dois algoritmos em cima desses dados reais: o antigo
 * saiu numa densidade de ~10.4 entradas/Hero (não batia os "5-7" nem
 * ele mesmo, porque a base de usuários ainda é pequena — poucas
 * completed isoladas disponíveis); o novo, com este `p`, saiu em ~7.0
 * — mais perto do alvo do que o próprio algoritmo antigo neste
 * dataset. Ajustável aqui se a frequência real no app não parecer
 * certa na prática (mesmo espírito do comentário antigo).
 */
const HERO_PROBABILITY = 0.4739;

/**
 * Hash determinístico simples (FNV-1a, 32 bits) — sem dependência
 * nova, só string → inteiro → normalizado pra `[0, 1)`. PURA: mesma
 * entrada, mesma saída, sempre, não lê nada além do próprio `id`.
 */
function hashActivityId(id: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) / 0xffffffff;
}

/**
 * Busca os DADOS BRUTOS (só banco, sem TMDB) do módulo de "quebra de
 * padrão" certo pra cada aba — "Em alta" (global) em "Para você",
 * "Amigos assistindo" (só quem você segue) em "Seguindo" — ver
 * `lib/trending.ts`. Isolado num try/catch próprio (não entra no
 * `Promise.all` de posts+atividade): é um extra decorativo, não o
 * conteúdo principal do Feed — se falhar (rede, RLS, o que for), o
 * Feed continua funcionando normalmente sem o módulo, em vez de a
 * tela inteira cair por causa dele.
 *
 * SEPARADA DA BUSCA DE RESUMOS (2026-10-02, reportado — "o feed demora
 * pra carregar") — CAUSA RAIZ: esta função e `fetchActivityFeedSafe`
 * cada uma batia, EM PARALELO, na mesma rota de resumos de mídia
 * (`/api/tmdb/library-summaries`) — 2 idas à rede em vez de 1, bem no
 * carregamento inicial (antes do conteúdo aparecer), competindo pelo
 * pool de conexão (só 15, plano Nano do Supabase — gargalo já
 * documentado noutra auditoria deste projeto). Agora só busca os IDS
 * de mídia necessários (sem buscar o resumo em si); `fetchFeedEntries`,
 * abaixo, combina esses ids com os de `fetchActivityRawData` numa
 * ÚNICA chamada a `fetchDisplaySummariesCached`, depois usa
 * `buildTrendingItems`/`buildFriendsWatchingItems` pra montar o
 * módulo final.
 */
type PatternBreakRaw =
  | { kind: "trending"; raw: TrendingRawData }
  | { kind: "friendsWatching"; raw: FriendsWatchingRawData };

async function fetchPatternBreakRawSafe(scope: FeedScope): Promise<PatternBreakRaw | null> {
  try {
    if (scope === "forYou") {
      return { kind: "trending", raw: await fetchTrendingRawData() };
    } else {
      return { kind: "friendsWatching", raw: await fetchFriendsWatchingRawData() };
    }
  } catch (error) {
    console.error("[useFeedEntries] Falha ao buscar dados brutos do módulo de quebra de padrão (ignorado)", error);
    return null;
  }
}

function buildPatternBreakEntry(
  patternBreakRaw: PatternBreakRaw | null,
  summaries: { movies: Record<number, MediaSummary>; series: Record<number, MediaSummary> }
): FeedEntry | null {
  if (!patternBreakRaw) return null;
  if (patternBreakRaw.kind === "trending") {
    const items = buildTrendingItems(patternBreakRaw.raw, summaries);
    if (items.length === 0) return null;
    return { kind: "trending", id: "pattern-break-trending", createdAt: new Date().toISOString(), items };
  } else {
    const items = buildFriendsWatchingItems(patternBreakRaw.raw, summaries);
    if (items.length === 0) return null;
    return { kind: "friendsWatching", id: "pattern-break-friends-watching", createdAt: new Date().toISOString(), items };
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
 *
 * TAMBÉM COBRE "completed" (2026-10-06, 2º bug real reportado com
 * print — post de review de "O Rebelde" aparecendo JUNTO com um card
 * "✓ assistiu" separado do mesmo título) — CAUSA RAIZ: este filtro só
 * comparava `activityType === "rated"` contra os posts de review,
 * nunca `"completed"`. Marcar como assistido (`movie_status`/
 * `series_status`) e escrever uma nota (`reviews`) são 2 escritas
 * INDEPENDENTES no banco (confirmado em `app/movies/[id].tsx` —
 * `handleToggleWatched` só grava status, `handleRate` só grava nota;
 * nada exige uma pela outra) — então `buildActivityItems` sempre gera
 * 2 `ActivityItem`s pro mesmo usuário+mídia quando as duas existem:
 * um `"completed"` (do status) e um `"rated"` (da nota). O filtro
 * antigo descartava só o `"rated"` quando havia post de review
 * publicado pra aquele título — o `"completed"` sobrevivia inteiro,
 * aparecendo como card "assistiu" separado ao lado do post. Mesma
 * lógica do comentário acima se aplica: o post de review já representa
 * a mídia como "vista" (é o pré-requisito de UI pra poder avaliar, ver
 * `app/movies/[id].tsx`) — não precisa de um card de atividade crua
 * repetindo isso.
 *
 * SÓ CONTA REVIEW COM TEXTO (2026-10-06, "Activity vs. Post de Review",
 * auditoria aprovada pelo usuário) — `createReviewPost` agora nunca cria
 * post com `body` vazio, mas posts antigos (criados antes da correção)
 * podem existir vazios no banco e NÃO devem suprimir a Activity `★
 * avaliou` correspondente — sem opinião publicada de verdade, não é
 * "o mesmo evento, só mais rico", é só uma nota crua igual a qualquer
 * outra. `p.body.trim()` filtra esse caso.
 */
function dedupeReviewActivity(posts: Post[], activity: ActivityItem[]): ActivityItem[] {
  const reviewedKeys = new Set(
    posts
      .filter((p) => p.type === "review" && p.mediaType && p.mediaId != null && p.body.trim().length > 0)
      .map((p) => `${p.userId}:${p.mediaType}:${p.mediaId}`)
  );
  return activity.filter(
    (item) =>
      !(
        (item.activityType === "rated" || item.activityType === "completed") &&
        reviewedKeys.has(`${item.userId}:${item.mediaType}:${item.mediaId}`)
      )
  );
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
 * `ActivityGroup`, EXCETO quando todo o cluster é sobre o MESMO título
 * (ver comentário grande de `mergeSameMediaCluster`, abaixo) — nesse
 * caso vira um `MergedActivityItem`. A renderização (ver
 * `ActivityGroupCard.tsx`) decide sozinha se mostra o resumo "mesmo
 * tipo" ou o resumo "misto" — não precisa de sub-divisão por tipo
 * aqui, só o agrupamento por usuário+tempo.
 */
const GROUP_WINDOW_MS = 15 * 60 * 1000;

/**
 * MESMO TÍTULO NÃO VIRA GRADE DE PÔSTERES (2026-10-02, reportado com
 * print — "terminar e avaliar o título, duplica o poster dele, quando
 * deveria aparecer tipo um hero e as ações") — CAUSA RAIZ:
 * `groupConsecutiveActivity` (acima) agrupa só por usuário+tempo, sem
 * olhar se é o MESMO título — um cluster "terminou X, avaliou X" (2
 * ações, poucos minutos de diferença) batia na mesma regra
 * `cluster.length >= 2` que um cluster de títulos DIFERENTES, virando
 * um `ActivityGroup` com 2 itens apontando pro MESMO `mediaId`;
 * `ActivityGroupCard` (pensado pra vários títulos lado a lado)
 * simplesmente desenhava o mesmo pôster duas vezes.
 *
 * Correção: depois de fechar um cluster de 2+, `groupConsecutiveActivity`
 * confere se TODOS os itens têm o mesmo `mediaId`+`mediaType` — se sim,
 * não é uma "rajada de títulos diferentes" (o caso que `ActivityGroup`
 * resolve), é a MESMA atividade vista por 2+ ações — funde num
 * `MergedActivityItem` aqui, renderizado como card único com uma
 * pílula por ação (`ActivityCard.tsx`, `MultiActionActivityCard`),
 * nunca como grade de pôsteres. Opção B escolhida entre 3 mockups
 * apresentados (A: hero cheio com pílulas sobre o pôster; B: card
 * padrão com verbo combinado "terminou e avaliou" + estrelas, igual ao
 * post de avaliação; C: selos sobrepostos no pôster) — pedido
 * explícito: "a opção B... adiciona acima do pôster o 'assistiu e
 * avaliou' com os símbolos".
 *
 * ESCOPO ORIGINAL, AGORA FECHADO (2026-10-06, bug real reportado com
 * print — "interagiu com 4 títulos" mostrando 6 pôsteres, "Legítimo
 * Rei" e "Cruzada" cada um repetido 2x) — o parágrafo abaixo descrevia
 * esse caso como deliberadamente fora de escopo; ACONTECEU na prática,
 * então deixou de ser aceitável. CAUSA RAIZ confirmada:
 * `ActivityGroupCard` desenha 1 pôster por item CRU de `group.items`,
 * sem nenhuma deduplicação por `mediaId`/`mediaType` — um cluster misto
 * com "terminou A, avaliou A, adicionou B à lista" virava um
 * `ActivityGroup` de 3 itens, 2 deles apontando pro MESMO `mediaId`
 * (A), logo 2 pôsteres idênticos de A lado a lado.
 *
 * Correção: `collapseSameMediaItems`, abaixo, roda ANTES de empacotar
 * o `ActivityGroup` — agrupa por `mediaId`+`mediaType` dentro do
 * cluster misto (preservando a ordem de primeira aparição) e funde
 * qualquer subgrupo de 2+ itens do MESMO título usando a MESMA
 * `mergeSameMediaCluster` já usada pelo caso "cluster inteiro é 1
 * título só" — resultando no MESMO `MergedActivityItem` (badges de
 * ação combinadas, 1 pôster) só que agora MISTURADO dentro de
 * `group.items`, ao lado dos títulos que só tiveram 1 ação. 1 entrada
 * por título, sempre — nunca mais pôster duplicado.
 */
function collapseSameMediaItems(cluster: ActivityItem[]): (ActivityItem | MergedActivityItem)[] {
  const seenMediaKeys = new Set<string>();
  const result: (ActivityItem | MergedActivityItem)[] = [];
  for (const item of cluster) {
    const mediaKey = `${item.mediaType}:${item.mediaId}`;
    if (seenMediaKeys.has(mediaKey)) continue; // já processado (junto com a 1ª ocorrência deste título) — não duplica.
    seenMediaKeys.add(mediaKey);
    const sameMediaItems = cluster.filter((it) => it.mediaType === item.mediaType && it.mediaId === item.mediaId);
    result.push(sameMediaItems.length >= 2 ? mergeSameMediaCluster(sameMediaItems) : item);
  }
  return result;
}

function mergeSameMediaCluster(cluster: ActivityItem[]): MergedActivityItem {
  // `cluster` chega na mesma ordem de `activity` (mais recente
  // primeiro, ver comentário grande de `groupConsecutiveActivity`,
  // acima) — `head` é a ação mais recente (usado pro `createdAt`,
  // mesmo critério que `ActivityGroup` já usa com `items[0]`);
  // invertido dá a ordem CRONOLÓGICA real (mais antiga primeiro), a
  // ordem natural pra listar "terminou, depois avaliou" como aconteceu
  // de verdade.
  //
  // `cluster[0]!` é seguro por construção — as 2 chamadas existentes
  // (cluster inteiro do mesmo título, ou subgrupo de `collapseSameMediaItems`)
  // só passam arrays com 2+ itens pra esta função; `!` é só pra calar
  // `noUncheckedIndexedAccess` (TS18048/TS2532 — achado real ao rodar
  // `tsc --noEmit` de verdade no projeto, 2026-10-06), mesmo idioma já
  // usado em `lib/anilist.ts:151`/`ProfileRecommendationsPreview.tsx:143`.
  const head = cluster[0]!;
  const chronological = [...cluster].reverse();
  const ratedAction = chronological.find((it) => it.activityType === "rated");
  return {
    id: cluster.map((it) => it.id).join("+"),
    userId: head.userId,
    userName: head.userName,
    userUsername: head.userUsername,
    userAvatarUrl: head.userAvatarUrl,
    userVerifiedTier: head.userVerifiedTier,
    mediaType: head.mediaType,
    mediaId: head.mediaId,
    mediaTitle: head.mediaTitle,
    mediaPosterPath: head.mediaPosterPath,
    createdAt: head.createdAt,
    actions: chronological.map((it) => it.activityType),
    rating: ratedAction?.rating ?? null,
  };
}

// AJUSTE DE TIPO, NÃO DE COMPORTAMENTO (2026-10-06, achado real ao
// rodar `tsc --noEmit` de verdade no projeto — `noUncheckedIndexedAccess`
// reprovava `activity[i]`/`activity[j]`/`cluster[0]`/`cluster[última]`
// com TS2532/TS18048 em TODA esta função, preexistente de antes desta
// sessão). Todo `!` abaixo é comprovadamente seguro pelo próprio
// controle de fluxo: `i`/`j` nunca avançam além de `activity.length`
// (guardado pelas condições dos 2 `while`) e `cluster` sempre tem pelo
// menos 1 item antes de qualquer leitura por índice — mesmo idioma já
// usado em `lib/anilist.ts:151`/`ProfileRecommendationsPreview.tsx:143`.
function groupConsecutiveActivity(activity: ActivityItem[]): (ActivityItem | ActivityGroup | MergedActivityItem)[] {
  const result: (ActivityItem | ActivityGroup | MergedActivityItem)[] = [];
  let i = 0;
  while (i < activity.length) {
    const cluster: ActivityItem[] = [activity[i]!];
    let j = i + 1;
    while (
      j < activity.length &&
      activity[j]!.userId === activity[i]!.userId &&
      new Date(cluster[cluster.length - 1]!.createdAt).getTime() - new Date(activity[j]!.createdAt).getTime() <= GROUP_WINDOW_MS
    ) {
      cluster.push(activity[j]!);
      j++;
    }
    if (cluster.length >= 2) {
      const sameMedia = cluster.every((it) => it.mediaId === cluster[0]!.mediaId && it.mediaType === cluster[0]!.mediaType);
      result.push(
        sameMedia ? mergeSameMediaCluster(cluster) : { userId: activity[i]!.userId, items: collapseSameMediaItems(cluster) }
      );
    } else {
      result.push(cluster[0]!);
    }
    i = j;
  }
  return result;
}

function isActivityGroup(entry: ActivityItem | ActivityGroup | MergedActivityItem): entry is ActivityGroup {
  return "items" in entry;
}

function isMergedActivity(entry: ActivityItem | ActivityGroup | MergedActivityItem): entry is MergedActivityItem {
  return "actions" in entry;
}

/**
 * MESMO CHECK, PRA DENTRO DE `ActivityGroup.items` (2026-10-06, ver
 * `collapseSameMediaItems`, acima) — exportado porque `ActivityGroupCard.tsx`
 * agora também precisa diferenciar `ActivityItem` de `MergedActivityItem`
 * ao desenhar cada tile do grid. Estruturalmente idêntico a
 * `isMergedActivity` (mesmo `"actions" in item`), só com a assinatura de
 * tipo certa pro union menor (`ActivityGroup.items` nunca contém um
 * `ActivityGroup` dentro de si, então não precisa do 3º membro do union).
 */
export function isMergedActivityItem(item: ActivityItem | MergedActivityItem): item is MergedActivityItem {
  return "actions" in item;
}

/**
 * Marca `heroEligible` nas entradas "completed" — elegibilidade
 * EXATAMENTE como antes (só `kind: "activity"` com
 * `activityType === "completed"`; atividade dentro de um grupo nunca
 * passa por aqui, nunca vira Hero). A DECISÃO em si agora é pura por
 * `activity.id` (ver comentário grande de `HERO_PROBABILITY`, acima)
 * — não depende de posição, de quem veio antes/depois, nem é chamada
 * com `.map()`-com-closure mais: dá pra rodar item a item, isolado,
 * sempre com o mesmo resultado.
 */
function applyHeroThrottle(entries: FeedEntry[]): FeedEntry[] {
  return entries.map((entry) => {
    if (entry.kind !== "activity" || entry.activity.activityType !== "completed") {
      return entry;
    }
    return { ...entry, heroEligible: hashActivityId(entry.activity.id) < HERO_PROBABILITY };
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
  if (entry.kind === "activityMulti") return entry.item.userId;
  return null; // "trending"/"friendsWatching" não têm autor — nunca passam por `rankEntries` hoje (só `composeFeed` os insere depois), fica defensivo mesmo assim.
}

// Multiplicador de 1 item de `ActivityGroup.items` — agora pode ser um
// `ActivityItem` cru OU um `MergedActivityItem` (2026-10-06, ver
// `collapseSameMediaItems`/`isMergedActivityItem`, acima); usa o MAIOR
// multiplicador entre as ações, nos dois casos (mesmo critério já usado
// pro grupo inteiro e pro `activityMulti`, abaixo).
function groupItemTypeMultiplier(item: ActivityItem | MergedActivityItem): number {
  if (isMergedActivityItem(item)) return Math.max(...item.actions.map((a) => activityTypeMultiplier(a)));
  return activityTypeMultiplier(item.activityType);
}

function entryTypeMultiplier(entry: FeedEntry): number {
  if (entry.kind === "post") return TYPE_MULTIPLIER_POST;
  if (entry.kind === "activity") return activityTypeMultiplier(entry.activity.activityType);
  if (entry.kind === "activityGroup") return Math.max(...entry.group.items.map(groupItemTypeMultiplier));
  if (entry.kind === "activityMulti") return Math.max(...entry.item.actions.map((a) => activityTypeMultiplier(a)));
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
 * Isolada em try/catch próprio, igual a `fetchPatternBreakRawSafe` — é
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
 * padrão já usado por `fetchPatternBreakRawSafe`/`fetchFollowedIds`, acima
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

async function fetchActivityRawSafe(scope: FeedScope): Promise<ActivityRawData | null> {
  try {
    return await fetchActivityRawData(scope);
  } catch (error) {
    console.error("[useFeedEntries] Falha ao buscar ATIVIDADE AUTOMÁTICA do Feed (dados brutos) — Feed continua com os posts, se essa 2ª fonte funcionar", error);
    return null;
  }
}

/**
 * JUNTA OS IDS DE MÍDIA DAS 2 FONTES (2026-10-02, reportado — "o feed
 * demora pra carregar") — ver comentário grande de
 * `fetchPatternBreakRawSafe`, acima, pra causa raiz completa. Em vez
 * de atividade automática e módulo de quebra de padrão baterem cada
 * uma na sua própria `fetchDisplaySummariesCached`, `fetchFeedEntries`
 * busca os ids das duas aqui e faz UMA chamada só, combinada.
 */
function collectCombinedMediaIds(
  activityRaw: ActivityRawData | null,
  patternBreakRaw: PatternBreakRaw | null
): { movieIds: number[]; seriesIds: number[] } {
  const movieIds = new Set<number>();
  const seriesIds = new Set<number>();
  if (activityRaw) {
    activityRaw.movieIds.forEach((id) => movieIds.add(id));
    activityRaw.seriesIds.forEach((id) => seriesIds.add(id));
  }
  if (patternBreakRaw?.kind === "trending") {
    patternBreakRaw.raw.topMovieIds.forEach(([id]) => movieIds.add(id));
    patternBreakRaw.raw.topSeriesIds.forEach(([id]) => seriesIds.add(id));
  } else if (patternBreakRaw?.kind === "friendsWatching") {
    patternBreakRaw.raw.topSeries.forEach(([id]) => seriesIds.add(id));
  }
  return { movieIds: [...movieIds], seriesIds: [...seriesIds] };
}

async function fetchFeedEntries(scope: FeedScope, locale: string): Promise<{ entries: FeedEntry[]; hadPartialFailure: boolean }> {
  // `followedIds` só é buscado em "forYou" — ver comentário grande de
  // `rankEntries`, acima: em "following" todo conteúdo já é de gente
  // seguida, o boost social seria uniforme (1.15× pra tudo) e NÃO
  // mudaria ordem nenhuma — só custaria 1 query extra sem efeito
  // nenhum no resultado. `Promise.resolve(new Set())` mantém o mesmo
  // formato de `Promise.all` abaixo sem ramificar a função em dois
  // caminhos.
  //
  // NENHUMA destas 4 chamadas bate no TMDB/`fetchDisplaySummariesCached`
  // mais (2026-10-02, ver `fetchPatternBreakRawSafe`/`fetchActivityRawSafe`,
  // acima) — são só leituras de banco, paralelas como sempre. A ÚNICA
  // chamada de resumos de mídia do Feed inteiro acontece logo abaixo,
  // combinando os ids das duas fontes que precisam dela.
  const [postsOrNull, activityRawOrNull, patternBreakRaw, followedIds] = await Promise.all([
    fetchPostsSafe(scope),
    fetchActivityRawSafe(scope),
    fetchPatternBreakRawSafe(scope),
    scope === "forYou" ? fetchFollowedIds() : Promise.resolve(new Set<string>()),
  ]);

  // AS DUAS FALHARAM — não tem o que mostrar; relança pra cair no MESMO
  // `catch`/`setIsError(true)` que `load()` já tinha antes desta mudança
  // (ver comentário grande de `load`, abaixo) — nenhum sistema de erro
  // novo, só preserva o `PageError` pro caso em que ele já fazia sentido.
  if (postsOrNull === null && activityRawOrNull === null) {
    throw new Error("[useFeedEntries] Falha ao buscar as duas fontes do Feed (posts e atividade) — ver os 2 erros individuais logados acima.");
  }

  const hadPartialFailure = postsOrNull === null || activityRawOrNull === null;
  const posts = postsOrNull ?? [];

  const { movieIds, seriesIds } = collectCombinedMediaIds(activityRawOrNull, patternBreakRaw);
  let summaries: { movies: Record<number, MediaSummary>; series: Record<number, MediaSummary> } = { movies: {}, series: {} };
  try {
    summaries = await fetchDisplaySummariesCached(movieIds, seriesIds, locale);
  } catch (error) {
    // `fetchDisplaySummariesCached`/a rota por trás já toleram falha
    // ponto a ponto por título (devolvem o que conseguiram) — este
    // catch é só defensivo, pro caso raríssimo de ela rejeitar a
    // promise inteira; itens sem resumo já são descartados normalmente
    // por `buildActivityItems`/`buildTrendingItems`/`buildFriendsWatchingItems`
    // (todos checam `if (!summary) continue`).
    console.error("[useFeedEntries] Falha ao buscar resumos de mídia combinados (pôster/título) — itens sem cache ficam sem aparecer", error);
  }

  const rawActivity = activityRawOrNull ? buildActivityItems(activityRawOrNull, summaries) : [];
  const patternBreak = buildPatternBreakEntry(patternBreakRaw, summaries);

  const dedupedActivity = dedupeReviewActivity(posts, rawActivity);
  const groupedActivity = groupConsecutiveActivity(dedupedActivity);

  const entries: FeedEntry[] = [
    ...posts.map((post): FeedEntry => ({ kind: "post", id: `post-${post.id}`, createdAt: post.createdAt, post })),
    ...groupedActivity.map((entry): FeedEntry => {
      if (isActivityGroup(entry)) {
        // `entry.items[0]!` — `ActivityGroup` só é criado (`groupConsecutiveActivity`,
        // acima) a partir de um cluster de 2+ itens; `items` nunca é vazio.
        return {
          kind: "activityGroup",
          id: `activity-group-${entry.userId}-${entry.items[0]!.id}`,
          createdAt: entry.items[0]!.createdAt,
          group: entry,
        };
      }
      if (isMergedActivity(entry)) {
        return { kind: "activityMulti", id: `activity-multi-${entry.id}`, createdAt: entry.createdAt, item: entry };
      }
      return { kind: "activity", id: `activity-${entry.id}`, createdAt: entry.createdAt, activity: entry, heroEligible: false };
    }),
  ];

  const ranked = rankEntries(entries, followedIds);
  const composed = composeFeed(ranked, patternBreak);

  // `applyHeroThrottle` só examina `kind: "activity"` — uma atividade
  // dentro de um grupo (`kind: "activityGroup"`) nunca passa por ali,
  // então nunca vira Hero (pedido explícito: "não usaria Hero card
  // quando isso acontecer... Hero deveria aparecer quando uma
  // atividade ISOLADA merece destaque"). CORREÇÃO (2026-10-06) — era
  // posicional, por isso precisava rodar por último, sobre a ordem já
  // composta; virou hash puro por `activity.id` (ver comentário
  // grande de `HERO_PROBABILITY`), não depende mais de onde roda no
  // pipeline. Continua por último só por organização, não por
  // necessidade.
  return { entries: applyHeroThrottle(composed), hadPartialFailure };
}

/**
 * CACHE PERSISTENTE NO APARELHO (2026-10-02, reportado — "o feed ainda
 * demora pra carregar, é possível ficar quase instantâneo?") — CAUSA
 * RAIZ do que sobrou de lentidão depois da junção das 2 chamadas de
 * resumo de mídia (sessão anterior): o cache de `useFeedEntries` era
 * só EM MEMÓRIA (`cacheRef`, um `Map` que vive e morre com o processo
 * JS) — ajuda ao trocar de aba "Para você"/"Seguindo" na MESMA
 * sessão, mas toda vez que o app é aberto do zero (processo novo), a
 * tela do Feed nasce sem nada, sempre esperando TODAS as consultas de
 * rede (posts + atividade + módulo + resumos de mídia) terminarem
 * antes de mostrar qualquer coisa — por mais rápidas que essas
 * consultas sejam, isso nunca é "instantâneo".
 *
 * MESMO padrão já usado em `useLibraryItems.ts`/`useCurrentUser.ts`
 * ("carregar instantaneamente", stale-while-revalidate): guarda a
 * última lista buscada com sucesso no `AsyncStorage` do aparelho (por
 * conta + aba + idioma). Ao montar, ANTES de qualquer busca de rede,
 * tenta ler esse cache — se existir, mostra ele NA HORA (sem
 * esqueleto nenhum) enquanto a busca de rede roda por trás, em
 * silêncio, e substitui pelo dado fresco assim que chega. Sem cache
 * (1º uso do app, ou depois de trocar de conta), continua caindo no
 * comportamento de sempre (esqueleto até a 1ª busca terminar).
 */
const FEED_CACHE_VERSION = 1;

function feedPersistKeyFor(userId: string | undefined, scope: FeedScope, locale: string): string | null {
  if (!userId) return null;
  return `seenlist:feed-entries:v${FEED_CACHE_VERSION}:${userId}:${scope}:${locale}`;
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
  const { session } = useAuth();
  const userId = session?.user?.id;
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
    async (
      isRefresh: boolean,
      targetKey: string,
      targetScope: FeedScope,
      targetLocale: string,
      targetUserId: string | undefined,
      // `silent` (2026-10-02, cache persistente — ver comentário grande
      // acima) — true quando já mostramos o cache do disco na hora: a
      // busca de rede continua acontecendo, mas sem reacender o
      // esqueleto de carregamento por cima do que já está na tela.
      silent = false
    ): Promise<boolean> => {
      if (isRefresh) setRefreshing(true);
      else if (!silent) setIsLoading(true);
      setIsError(false);

      try {
        const data = await fetchFeedEntries(targetScope, targetLocale);
        cacheRef.current.set(targetKey, data.entries);
        if (keyRef.current === targetKey) setEntries(data.entries);
        const persistKey = feedPersistKeyFor(targetUserId, targetScope, targetLocale);
        if (persistKey) {
          AsyncStorage.setItem(persistKey, JSON.stringify(data.entries)).catch((error) => {
            console.warn("[useFeedEntries] Falha ao salvar cache local do Feed — sem efeito na tela atual", error);
          });
        }
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
      return;
    }

    // Nada em memória ainda (1ª vez que esta aba+idioma aparece NESTE
    // processo do app) — tenta o cache do disco antes de qualquer
    // busca de rede (ver comentário grande de `feedPersistKeyFor`,
    // acima).
    let cancelled = false;

    async function init() {
      const persistKey = feedPersistKeyFor(userId, scope, locale);
      let shownFromDisk = false;
      if (persistKey) {
        try {
          const raw = await AsyncStorage.getItem(persistKey);
          if (!cancelled && raw && keyRef.current === cacheKey) {
            const cached = JSON.parse(raw) as FeedEntry[];
            cacheRef.current.set(cacheKey, cached);
            setEntries(cached);
            setIsLoading(false);
            setIsError(false);
            shownFromDisk = true;
          }
        } catch (error) {
          console.warn("[useFeedEntries] Cache local do Feed corrompido ou ilegível — ignorando", error);
        }
      }
      if (cancelled || keyRef.current !== cacheKey) return;
      if (!shownFromDisk) setEntries(null);
      load(false, cacheKey, scope, locale, userId, shownFromDisk);
    }

    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `scope`/`locale` já estão representados em `cacheKey`
  }, [cacheKey, load, userId]);

  const refetch = useCallback(() => load(true, keyRef.current, scope, locale, userId), [load, scope, locale, userId]);

  return { entries, isLoading, isError, refreshing, refetch };
}
