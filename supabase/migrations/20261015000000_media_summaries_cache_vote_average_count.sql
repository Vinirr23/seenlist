-- NOVO (a pedido, 2026-10-15 — "O que assistir?": selo de nota nos
-- pôsteres de 'Assistir a seguir' + sugestão única ponderada por nota
-- e quantidade de votos) — adiciona `vote_average`/`vote_count` da
-- TMDB ao cache compartilhado que `/api/tmdb/library-summaries` já
-- mantém (ver migração `20260905000000_media_summaries_cache.sql`,
-- mesmo padrão já usado em `20260927000000_media_summaries_cache_
-- original_title.sql` pra `original_title`).
--
-- POR QUE AQUI, E NÃO BUSCANDO NOTA FILME A FILME DO LADO DO APP —
-- `getMovieSummary`/`getSeriesSummary` (lib/tmdb/client.ts) já fazem
-- UMA chamada por item (`/movie/{id}`, `/tv/{id}`) pra montar o
-- resumo (título/pôster/ano) que a Biblioteca inteira usa — a TMDB já
-- devolve `vote_average`/`vote_count` de graça NESSA MESMA resposta,
-- só ninguém lia esses dois campos ainda. Gravar aqui não custa
-- nenhuma chamada nova ao TMDB nem ao Postgres, pra biblioteca de
-- qualquer tamanho — mesmo raciocínio exato do `original_title`.
--
-- `vote_count integer` (não `bigint`) — a TMDB nunca devolve uma
-- contagem de votos que chegue perto do teto de `integer` (2^31-1)
-- pra filme/série nenhum.
--
-- `null` (não `not null`) de propósito — linhas já existentes em
-- cache (gravadas antes destas colunas existirem) ficam `null` até
-- expirarem naturalmente (`CACHE_TTL_HOURS`, na própria rota) e serem
-- regravadas com os campos novos; não precisa de backfill.
alter table media_summaries_cache
  add column if not exists vote_average numeric,
  add column if not exists vote_count integer;
