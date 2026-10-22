// supabase/functions/enrich-media-countries/index.ts
//
// NOVA (2026-10-17, emblemas Nômade/Pelo Mundo/Drama Lover/Comédia em
// Dia/Explorador — plano aprovado "24 emblemas restantes", seção 7) —
// enriquece em lotes controlados o histórico de `media_summaries_cache`
// que ainda não tem país/gênero, SEM depender de ninguém reabrir
// manualmente cada título (pedido explícito do usuário). Segue o MESMO
// padrão já usado por `daily-status-recalc`/`check-new-releases`
// (deploy + `pg_cron`/`pg_net`, ver README-cron.md) — não é
// infraestrutura nova, é o mesmo mecanismo que o projeto já tem rodando
// pra outras 4 functions.
//
// DECISÃO DO USUÁRIO (perguntada direto, 2026-10-17) — esta function
// também enriquece GÊNERO (`genres`, agora ids — ver migration
// `20261017000002`), não só país: `/movie/{id}` e `/tv/{id}` já
// devolvem os dois campos na MESMA resposta, então enriquecer os dois
// juntos é custo zero de chamada extra ao TMDB. A alternativa (só
// país, gênero ficando só no caminho lazy) foi recusada — sem isso,
// Drama Lover/Comédia em Dia/Explorador ficariam praticamente vazios
// pra qualquer conta com histórico antigo, por tempo indeterminado.
//
// SELEÇÃO DO LOTE: `genres is null` é o ÚNICO critério de "ainda não
// enriquecido" — de propósito, não filtra por país também. Motivo:
// `production_countries` é só de FILME e `origin_countries` só de
// SÉRIE (campos mutuamente exclusivos por design — ver migration
// `20261017000001`), então filtrar por "o país da minha categoria
// está null" exigiria separar a query por `media_type`, sem necessidade
// real — esta function sempre grava `genres` (mesmo que `[]`, nunca
// deixa null de novo) JUNTO com o país que se aplica a cada linha, na
// MESMA chamada TMDB, então uma linha só sai do lote quando as duas
// coisas já foram resolvidas. Filtrar só por `genres is null` evita o
// bug de reprocessar filme pra sempre por causa de
// `origin_countries` (que NUNCA vai deixar de ser null num filme, de
// propósito).
//
// NÃO backfilla `series_season_episode_counts` (Temporada Concluída)
// — decisão explícita do usuário: isso exigiria uma chamada TMDB POR
// TEMPORADA (não por título), custo bem maior; por ora aquele cache
// só popula pelo caminho lazy já existente
// (`cacheSeasonEpisodeCount` em `apps/web/lib/tmdb/client.ts`).
//
// EXPANDIDA (2026-10-17, feedback de revisão da feature "O que
// assistir?" — notas não apareciam nos pôsteres/sugestão de filmes
// antigos na biblioteca) — passa a também enriquecer `vote_average`/
// `vote_count` (migration `20261015000000_media_summaries_cache_
// vote_average_count.sql`), pelo MESMO motivo de sempre: `/movie/{id}`
// e `/tv/{id}` já devolvem os dois campos de graça na MESMA resposta
// já buscada aqui, zero chamada nova ao TMDB. CAUSA RAIZ do que
// motivou isso: aquela migration foi de propósito SEM backfill
// (confiando só na expiração natural do cache de 24h pra regravar),
// mas uma linha só reexpira quando alguém abre a ficha daquele título
// OU a biblioteca inteira recarrega — um filme só na watchlist, nunca
// aberto individualmente, podia ficar sem nota por tempo indeterminado.
//
// SELEÇÃO DO LOTE ampliada por causa disso: antes só `genres is null`;
// agora `genres is null OR vote_average is null` — necessário porque
// uma linha pode já ter sido enriquecida de país/gênero (antes desta
// mudança) mas continuar sem nota, e o filtro antigo nunca a pegaria
// de novo.

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TMDB_API_KEY = Deno.env.get("TMDB_API_KEY")!;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

/**
 * AUMENTADO (2026-10-17, a pedido — "acelerar o backfill") — era 40
 * por execução. Motivo: depois de corrigir o bug de Drama Lover/
 * Comédia em Dia nesta mesma sessão (`20261017000007`), rodando a
 * avaliação real contra o banco (ver `claude/SEENLIST-SESSAO-2026-10-17-...`
 * no projeto), a biblioteca de teste tinha 1.441 títulos e só 13
 * gêneros distintos já identificados — ou seja, a esmagadora maioria
 * do catálogo ainda não tinha sido reprocessada desde que `genres`
 * foi recriada vazia (`20261017000002`). No ritmo antigo (40 × 4/hora
 * = até 3.840/dia), uma biblioteca desse tamanho levaria bem mais de
 * um dia só pra cobrir as linhas JÁ CACHEADAS, sem contar o resto do
 * catálogo que outros usuários também vão cruzar.
 *
 * 150 por execução, MESMA cadência de 15 minutos (cron não mudou) —
 * 150 × 4/hora = até 14.400/dia, ~3,75× mais rápido. Ainda
 * confortavelmente dentro do limite de requisição do TMDB (a
 * concorrência controlada abaixo, `TMDB_CONCURRENCY`, não mudou) — a
 * MESMA margem de segurança de antes, só processando mais títulos por
 * execução, não mais frequentemente.
 */
const BATCH_SIZE = 150;

/** Mesmo padrão de paralelismo controlado de `check-new-releases` — paraleliza a parte lenta (rede), sem estourar limite de requisição simultânea do TMDB. */
const TMDB_CONCURRENCY = 10;

interface CacheRow {
  tmdb_id: number;
  media_type: "movie" | "series";
  language: string;
}

interface TmdbMovieResponse {
  genres: { id: number; name: string }[];
  production_countries: { iso_3166_1: string; name: string }[];
  vote_average: number;
  vote_count: number;
}

interface TmdbSeriesResponse {
  genres: { id: number; name: string }[];
  origin_country: string[];
  vote_average: number;
  vote_count: number;
}

interface EnrichResult {
  row: CacheRow;
  genreIds: number[];
  productionCountries: string[] | null;
  originCountries: string[] | null;
  voteAverage: number | null;
  voteCount: number | null;
}

async function enrichOne(row: CacheRow): Promise<EnrichResult | null> {
  try {
    const path = row.media_type === "movie" ? "movie" : "tv";
    const response = await fetch(`${TMDB_BASE_URL}/${path}/${row.tmdb_id}?api_key=${TMDB_API_KEY}&language=${row.language}`);
    if (!response.ok) {
      // Título pode ter sido removido do TMDB, ou id inválido — não
      // trava o resto do lote. Fica pra tentar de novo na próxima
      // execução (continua batendo no filtro `genres is null or
      // vote_average is null`).
      console.warn(`[enrich-media-countries] TMDB respondeu ${response.status} pra ${row.media_type} ${row.tmdb_id} (${row.language}).`);
      return null;
    }

    if (row.media_type === "movie") {
      const data = (await response.json()) as TmdbMovieResponse;
      return {
        row,
        genreIds: (data.genres ?? []).map((g) => g.id),
        productionCountries: (data.production_countries ?? []).map((c) => c.iso_3166_1),
        originCountries: null,
        voteAverage: data.vote_average ?? null,
        voteCount: data.vote_count ?? null,
      };
    }

    const data = (await response.json()) as TmdbSeriesResponse;
    return {
      row,
      genreIds: (data.genres ?? []).map((g) => g.id),
      productionCountries: null,
      originCountries: data.origin_country ?? [],
      voteAverage: data.vote_average ?? null,
      voteCount: data.vote_count ?? null,
    };
  } catch (error) {
    console.error(`[enrich-media-countries] Falha ao buscar ${row.media_type} ${row.tmdb_id} (${row.language}) no TMDB.`, error);
    return null;
  }
}

async function enrichMediaCountries(): Promise<void> {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: rows, error: selectError } = await supabase
    .from("media_summaries_cache")
    .select("tmdb_id, media_type, language")
    // AMPLIADO (2026-10-17) — era só `genres is null`; agora também
    // pega linha que já tem gênero/país mas ainda não tem nota (ver
    // comentário grande no topo do arquivo).
    .or("genres.is.null,vote_average.is.null")
    .order("fetched_at", { ascending: false })
    .limit(BATCH_SIZE);

  if (selectError) {
    console.error("[enrich-media-countries] Falha ao ler lote de media_summaries_cache.", selectError.message);
    return;
  }

  if (!rows || rows.length === 0) {
    console.log("[enrich-media-countries] concluído — nenhuma linha pendente de enriquecimento.");
    return;
  }

  let enriched = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i += TMDB_CONCURRENCY) {
    const batch = (rows as CacheRow[]).slice(i, i + TMDB_CONCURRENCY);
    const results = await Promise.all(batch.map((row) => enrichOne(row)));

    for (const result of results) {
      if (!result) {
        failed++;
        continue;
      }

      const { row, genreIds, productionCountries, originCountries, voteAverage, voteCount } = result;
      const { error: updateError } = await supabase
        .from("media_summaries_cache")
        .update({
          genres: genreIds,
          production_countries: productionCountries,
          origin_countries: originCountries,
          vote_average: voteAverage,
          vote_count: voteCount,
        })
        .eq("media_type", row.media_type)
        .eq("tmdb_id", row.tmdb_id)
        .eq("language", row.language);

      if (updateError) {
        console.error(`[enrich-media-countries] Falha ao gravar ${row.media_type} ${row.tmdb_id} (${row.language}).`, updateError.message);
        failed++;
      } else {
        enriched++;
      }
    }
  }

  // A PEDIDO (mesmo padrão de check-new-releases) — resumo só no log,
  // quem chamou já recebeu resposta muito antes disso terminar.
  console.log(`[enrich-media-countries] concluído — lote=${rows.length} enriquecidas=${enriched} falhas=${failed}`);
}

Deno.serve(() => {
  // @ts-expect-error — EdgeRuntime é uma global do runtime do Supabase (Deno Deploy), não existe no tipo padrão do Deno.
  EdgeRuntime.waitUntil(enrichMediaCountries());
  return new Response(JSON.stringify({ accepted: true }), {
    status: 202,
    headers: { "Content-Type": "application/json" },
  });
});
