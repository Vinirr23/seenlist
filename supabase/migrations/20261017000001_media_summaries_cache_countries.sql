-- SeenList — media_summaries_cache: país de produção/origem
-- (2026-10-17, plano aprovado — emblemas Nômade/Pelo Mundo).
--
-- Dois campos DISTINTOS do TMDB, de propósito não misturados numa
-- coluna só: `production_countries` (onde o filme/série foi
-- PRODUZIDO, `/movie/{id}` e `/tv/{id}`) e `origin_country` (país de
-- ORIGEM da série, só existe em `/tv/{id}`, campo próprio — pedido
-- explícito do usuário: "para filmes, usar países de produção; para
-- séries, usar países de origem"). Os dois já vêm de graça na MESMA
-- chamada que `getMovieSummary`/`getSeriesSummary` já fazem hoje pra
-- título/poster/gênero — zero requisição nova ao TMDB por título,
-- só passar a ler e salvar 2 campos que a resposta já trazia.
--
-- ISO 3166-1 alpha-2 (ex.: 'BR', 'US') — mesmo formato que o TMDB já
-- devolve, sem tradução/normalização adicional (país não tem o
-- problema de nome-traduzido-por-idioma que gênero tinha, o código
-- ISO é universal).
--
-- Nullable, sem backfill nesta migration — populam de duas formas,
-- igual a `genres`/`year` hoje: (1) lazy, na próxima vez que alguém
-- abrir aquele título na Biblioteca (o endpoint já busca o resumo
-- inteiro de novo quando o cache expira); (2) a Edge Function
-- `enrich-media-countries` (ver `supabase/functions/`), que varre o
-- histórico em lotes controlados, sem depender de ninguém abrir nada
-- manualmente.
alter table public.media_summaries_cache
  add column if not exists production_countries text[],
  add column if not exists origin_countries text[];

comment on column public.media_summaries_cache.production_countries is
  'Países de produção (ISO 3166-1 alpha-2), de `production_countries` do TMDB. Usado por FILMES (emblemas Nômade/Pelo Mundo). Nullable: populado lazy (próxima abertura do título) ou pela Edge Function enrich-media-countries.';
comment on column public.media_summaries_cache.origin_countries is
  'Países de origem (ISO 3166-1 alpha-2), de `origin_country` do TMDB — campo PRÓPRIO de série, diferente de production_countries (onde foi produzida vs. de onde é originária). Usado por SÉRIES (emblemas Nômade/Pelo Mundo). Nullable, mesma estratégia de população de production_countries.';

notify pgrst, 'reload schema';
