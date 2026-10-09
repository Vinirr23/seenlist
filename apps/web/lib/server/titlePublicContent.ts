import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * A PEDIDO (2026-10-09 — SEO Fase 2, páginas públicas de filme/série
 * em `/title/movie|series/[id]`). Mesmo padrão de `reviewShareCard.ts`/
 * `profileShareCard.ts` (ler esses dois primeiro se for tocar aqui):
 * `createAdminClient()` porque quem chama é um visitante sem sessão
 * (rastreador OU pessoa anônima abrindo a página pública) — a
 * visibilidade do AUTOR é replicada NA MÃO em toda consulta deste
 * arquivo, exatamente como nos outros dois. Review de autor com
 * `profile_visibility !== 'public'` nunca aparece em nenhum resultado
 * daqui — nem na lista exibida, nem na média/contagem, nem no sitemap.
 *
 * Critério de elegibilidade pra indexação/sitemap (decisão do usuário,
 * 2026-10-09): um título só é elegível se tiver pelo menos UMA review
 * pública real NO NÍVEL DO PRÓPRIO FILME/SÉRIE — nunca de temporada
 * ou episódio. Por isso `season_number is null and episode_number is
 * null` em toda consulta de `reviews` que decide elegibilidade de
 * TÍTULO abaixo — mesmo filtro que `useReviewAggregate`/`useReviews`
 * (`lib/queries/social/reviews.ts`) já usam pro mesmo "alvo" dentro do
 * app logado. Biblioteca privada (`movie_status`/`series_status`/
 * `watched_episodes`) NUNCA entra em nenhum cálculo deste arquivo, de
 * propósito — review é o único sinal de "conteúdo público real"
 * aceito aqui.
 */

type SupabaseAdminClient = ReturnType<typeof createAdminClient>;

export type TitleMediaType = "movie" | "series";

export interface TitleCommunityReview {
  id: string;
  rating: number | null;
  reviewText: string | null;
  containsSpoiler: boolean;
  createdAt: string;
  author: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
    verifiedTier: "gold" | "blue" | null;
  };
}

export interface TitleCommunityAggregate {
  average: number;
  count: number;
}

export interface TitleCommunityContent {
  /** Mais recentes primeiro, só pra EXIBIR na página — nunca usada pra calcular `aggregate` abaixo. */
  reviews: TitleCommunityReview[];
  /**
   * BUG A EVITAR (pedido explícito do usuário, 2026-10-09) — média e
   * contagem têm que representar TODAS as reviews públicas elegíveis
   * do título, não só as `REVIEWS_DISPLAY_LIMIT` mais recentes que
   * aparecem em `reviews` acima. Por isso vem do mesmo conjunto
   * completo (`fetchAllTitleLevelReviewRows`, paginado — ver
   * `fetchAllPages` abaixo) que decide `isEligibleForIndexing` —
   * nunca de `reviews.length`/`reviews.map`. `null` quando não há
   * nenhuma review com nota.
   */
  aggregate: TitleCommunityAggregate | null;
  isEligibleForIndexing: boolean;
}

interface ReviewRow {
  id: string;
  user_id: string;
  rating: number | null;
  review_text: string | null;
  contains_spoiler: boolean;
  created_at: string;
}

interface PublicProfileRow {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  verified_tier: "gold" | "blue" | null;
}

const REVIEWS_DISPLAY_LIMIT = 20;

/**
 * BUG A EVITAR (pedido explícito do usuário, 2026-10-09 — "paginação
 * das consultas ao Supabase para evitar limites silenciosos de
 * registros") — o PostgREST por trás do Supabase devolve no máximo
 * ~1000 linhas por resposta mesmo sem nenhum `.limit()`/`.range()`
 * explícito na chamada (`db-max-rows`, configurável no projeto, mas
 * sempre existe algum teto). Sem paginar, qualquer consulta "pega
 * tudo" aqui (reviews de um título muito avaliado, perfis públicos e
 * reviews públicas site-wide pro sitemap) voltaria CORTADA
 * silenciosamente acima desse teto — sem erro nenhum, sem aviso — e
 * a média/contagem de um título, ou o sitemap inteiro, ficariam
 * incompletos sem ninguém notar. Esta função pagina com `.range()`
 * até uma página voltar menor que `PAGE_SIZE`, acumulando tudo.
 */
const PAGE_SIZE = 1000;

async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  context: string
): Promise<T[]> {
  const allRows: T[] = [];
  let from = 0;
  // Laço com teto de segurança (1000 páginas = até 1 milhão de linhas) — só pra nunca travar em loop infinito se o Supabase devolver algo inesperado; na prática a condição de saída normal é `rows.length < PAGE_SIZE`.
  for (let page = 0; page < 1000; page++) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) {
      console.error(`[titlePublicContent] Falha ao paginar ${context}`, error);
      break;
    }
    const rows = data ?? [];
    allRows.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return allRows;
}

/**
 * Todas as reviews de NÍVEL DE TÍTULO (sem temporada/episódio), não
 * apagadas, com nota e/ou texto, pra um filme/série — SEM filtrar
 * ainda por visibilidade do autor (isso é feito depois, cruzando com
 * `profiles`, porque `reviews`/`profiles` não têm FK direta entre si
 * — mesma limitação já documentada em `reviewShareCard.ts`/
 * `lib/queries/social/reviews.ts`: sempre duas consultas, nunca
 * embedding do PostgREST). Paginada (ver `fetchAllPages`) — é a
 * partir DESTE conjunto completo que `aggregate`/`isEligibleForIndexing`
 * são calculados; só a LISTA exibida (`reviews`) é cortada depois.
 * `.order()` por dois campos (não só `created_at`) garante paginação
 * estável mesmo quando duas reviews têm o mesmíssimo timestamp.
 */
async function fetchAllTitleLevelReviewRows(
  supabase: SupabaseAdminClient,
  mediaType: TitleMediaType,
  mediaId: number
): Promise<ReviewRow[]> {
  return fetchAllPages<ReviewRow>(
    (from, to) =>
      supabase
        .from("reviews")
        .select("id, user_id, rating, review_text, contains_spoiler, created_at")
        .eq("media_type", mediaType)
        .eq("media_id", mediaId)
        .is("season_number", null)
        .is("episode_number", null)
        .is("deleted_at", null)
        .or("rating.not.is.null,review_text.not.is.null")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to),
    `reviews do título ${mediaType}:${mediaId}`
  );
}

/** Dos `userIds` recebidos, devolve só os perfis com `profile_visibility = 'public'`. Paginada por segurança — na prática só seria exercitada por um título com mais de 1000 autores distintos. */
async function fetchPublicProfilesByUserIds(
  supabase: SupabaseAdminClient,
  userIds: string[]
): Promise<Map<string, PublicProfileRow>> {
  const byId = new Map<string, PublicProfileRow>();
  if (userIds.length === 0) return byId;

  const rows = await fetchAllPages<PublicProfileRow>(
    (from, to) =>
      supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url, verified_tier")
        .in("user_id", userIds)
        .eq("profile_visibility", "public")
        .order("user_id")
        .range(from, to),
    "autores das reviews"
  );
  for (const row of rows) byId.set(row.user_id, row);
  return byId;
}

export async function fetchTitleCommunityContent(
  mediaType: TitleMediaType,
  mediaId: number
): Promise<TitleCommunityContent> {
  const supabase = createAdminClient();

  const allRows = await fetchAllTitleLevelReviewRows(supabase, mediaType, mediaId);
  const userIds = [...new Set(allRows.map((row) => row.user_id))];
  const publicProfiles = await fetchPublicProfilesByUserIds(supabase, userIds);

  // Mesma regra de "não revela quem é privado": review de autor que não está (mais) público simplesmente não existe pra quem olha de fora.
  const publicRows = allRows.filter((row) => publicProfiles.has(row.user_id));

  const ratedRows = publicRows.filter((row) => row.rating !== null);
  const aggregate: TitleCommunityAggregate | null =
    ratedRows.length > 0
      ? {
          average: ratedRows.reduce((sum, row) => sum + Number(row.rating), 0) / ratedRows.length,
          count: ratedRows.length,
        }
      : null;

  const reviews: TitleCommunityReview[] = publicRows.slice(0, REVIEWS_DISPLAY_LIMIT).map((row) => {
    const profile = publicProfiles.get(row.user_id)!;
    return {
      id: row.id,
      rating: row.rating === null ? null : Number(row.rating),
      reviewText: row.review_text,
      containsSpoiler: row.contains_spoiler,
      createdAt: row.created_at,
      author: {
        username: profile.username,
        displayName: profile.display_name ?? profile.username,
        avatarUrl: profile.avatar_url,
        verifiedTier: profile.verified_tier,
      },
    };
  });

  return {
    reviews,
    aggregate,
    isEligibleForIndexing: publicRows.length > 0,
  };
}

// =====================================================================
// Elegibilidade para `app/sitemap.ts` — títulos, perfis (`/u/`) e
// reviews (`/r/`) públicas, tudo numa função só (`fetchSitemapEligible
// Content`). Só DUAS consultas no total (perfis públicos + reviews
// públicas, cada uma paginada com `fetchAllPages`) — nunca uma
// consulta por item (nada de N+1), e nunca duas vezes a MESMA
// consulta (títulos e reviews usavam duas consultas sitewide a
// `reviews` em separado antes desta revisão — unificadas aqui num
// laço só sobre o mesmo resultado).
//
// Numa base muito maior que a atual, o próximo passo natural seria
// uma função de banco (RPC) que já cruza `reviews`/`profiles` dentro
// do Postgres — não fiz isso agora porque não era necessário
// recriar/alterar schema pra este volume (decisão do usuário: "não
// modificar o banco de dados se os dados já estão disponíveis").
// =====================================================================

interface SitewideReviewRow {
  id: string;
  user_id: string;
  media_type: string;
  media_id: number;
  season_number: number | null;
  episode_number: number | null;
  created_at: string;
  updated_at: string;
}

export interface EligibleTitleSitemapEntry {
  mediaType: TitleMediaType;
  mediaId: number;
  lastReviewAt: string;
}

export interface EligibleProfileSitemapEntry {
  username: string;
  updatedAt: string;
}

export interface EligibleReviewSitemapEntry {
  reviewId: string;
  updatedAt: string;
}

export interface SitemapEligibleContent {
  titles: EligibleTitleSitemapEntry[];
  profiles: EligibleProfileSitemapEntry[];
  reviews: EligibleReviewSitemapEntry[];
}

async function fetchSitemapEligibleContentUncached(): Promise<SitemapEligibleContent> {
  const supabase = createAdminClient();

  const [profileRows, reviewRows] = await Promise.all([
    fetchAllPages<{ user_id: string; username: string; updated_at: string }>(
      (from, to) =>
        supabase
          .from("profiles")
          .select("user_id, username, updated_at")
          .eq("profile_visibility", "public")
          .order("user_id")
          .range(from, to),
      "perfis públicos (sitemap)"
    ),
    // Review não apagada, com nota e/ou texto, EM QUALQUER NÍVEL (filme/série/temporada/episódio) — `/r/[reviewId]` já funciona pra qualquer uma (`reviewShareCard.ts` não restringe por season/episode). O filtro de NÍVEL DE TÍTULO (season/episode nulos), só exigido pra entrar na lista de TÍTULOS abaixo, é aplicado em memória a partir deste mesmo conjunto — não numa segunda consulta.
    fetchAllPages<SitewideReviewRow>(
      (from, to) =>
        supabase
          .from("reviews")
          .select("id, user_id, media_type, media_id, season_number, episode_number, created_at, updated_at")
          .is("deleted_at", null)
          .or("rating.not.is.null,review_text.not.is.null")
          .order("id")
          .range(from, to),
      "reviews públicas (sitemap)"
    ),
  ]);

  const publicUserIds = new Set(profileRows.map((row) => row.user_id));
  const profiles: EligibleProfileSitemapEntry[] = profileRows.map((row) => ({
    username: row.username,
    updatedAt: row.updated_at,
  }));

  const latestByTitle = new Map<string, EligibleTitleSitemapEntry>();
  const reviews: EligibleReviewSitemapEntry[] = [];

  for (const row of reviewRows) {
    if (!publicUserIds.has(row.user_id)) continue;

    reviews.push({ reviewId: row.id, updatedAt: row.updated_at });

    if (row.season_number !== null || row.episode_number !== null) continue; // só nível de título entra na lista de títulos
    const mediaType = row.media_type as TitleMediaType;
    const key = `${mediaType}:${row.media_id}`;
    const existing = latestByTitle.get(key);
    if (!existing || row.created_at > existing.lastReviewAt) {
      latestByTitle.set(key, { mediaType, mediaId: row.media_id, lastReviewAt: row.created_at });
    }
  }

  return { titles: [...latestByTitle.values()], profiles, reviews };
}

/**
 * A PEDIDO (2026-10-09 — correção do build da Vercel sem perder o
 * cache de 1h). Depois de `force-dynamic` em `app/sitemap.ts` resolver
 * o build (a rota não tenta mais gerar no momento do build, então
 * `SUPABASE_SERVICE_ROLE_KEY` só precisa existir em runtime — onde ela
 * sempre esteve disponível, é a mesma chave que `reviewShareCard.ts`/
 * `profileShareCard.ts` já usam em runtime sem problema), restava o
 * pedido de evitar recalcular tudo (duas consultas paginadas ao
 * Supabase) a cada request ao sitemap. `unstable_cache` é a API nativa
 * do Next.js 15 pra isso — cache de DADOS (não de rota: funciona junto
 * com `force-dynamic`, que só desliga o cache/pré-renderização da
 * ROTA em si), com `revalidate` próprio, sem nenhuma dependência nova.
 *
 * Resiliência a falha temporária do Supabase (pedido explícito) — o
 * `unstable_cache` do Next SÓ substitui o valor em cache quando a
 * função encapsulada retorna com sucesso; uma falha durante uma
 * revalidação em segundo plano não é documentada como preservando
 * garantidamente a entrada antiga em todo runtime/adapter. Por isso
 * a resiliência é explícita aqui, não assumida do framework: guarda o
 * último resultado que deu certo em `lastKnownGoodContent` (variável
 * de módulo) e, se o Supabase falhar, devolve esse último bom resultado
 * em vez de propagar o erro (que faria o Next servir um 500 em
 * `/sitemap.xml` pros buscadores). Só na PRIMEIRA falha, sem nenhum
 * sucesso anterior ainda (ex.: o próprio processo acabou de subir e o
 * Supabase já está fora), devolve listas vazias — o sitemap sai só com
 * as 4 páginas estáticas, nunca quebrado — até a próxima revalidação
 * conseguir popular o cache de verdade.
 */
let lastKnownGoodContent: SitemapEligibleContent | null = null;

async function fetchSitemapEligibleContentResilient(): Promise<SitemapEligibleContent> {
  try {
    const content = await fetchSitemapEligibleContentUncached();
    lastKnownGoodContent = content;
    return content;
  } catch (error) {
    console.error("[titlePublicContent] Falha ao buscar conteúdo elegível do sitemap — usando último resultado conhecido", error);
    return lastKnownGoodContent ?? { titles: [], profiles: [], reviews: [] };
  }
}

export const fetchSitemapEligibleContent = unstable_cache(
  fetchSitemapEligibleContentResilient,
  ["sitemap-eligible-content"],
  { revalidate: 3600 }
);
