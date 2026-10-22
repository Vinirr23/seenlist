-- SeenList — series_season_episode_counts (2026-10-17, plano aprovado
-- — emblema "Temporada Concluída").
--
-- ACHADO (bloqueador real, não contornável só com SQL) — nenhuma
-- tabela do banco guarda quantos episódios uma TEMPORADA tem (só
-- `media_summaries_cache.total_episodes`, que é da SÉRIE inteira).
-- Sem isso, não tem como `evaluate_and_unlock_achievements` (Postgres,
-- sem acesso ao TMDB) saber se uma temporada está "100% assistida".
-- Decisão do usuário, perguntada direto: criar uma tabela de cache
-- nova, em vez de adiar o emblema ou trocar o critério.
--
-- MESMA RECEITA de `media_summaries_cache`/`season_recaps` — cache
-- COMPARTILHADO entre todos os usuários (a contagem de episódios de
-- uma temporada é a mesma pra todo mundo, não depende de quem olha),
-- RLS SEM NENHUMA policy (só a chave de serviço do servidor
-- lê/escreve), chave composta.
--
-- NÃO depende de idioma (diferente de `media_summaries_cache.genres`
-- antes desta mesma rodada de migrations) — contagem de episódio é a
-- mesma TMDB em qualquer idioma, por isso `language` não faz parte da
-- chave aqui.
create table public.series_season_episode_counts (
  series_id integer not null,
  season_number integer not null,
  episode_count integer not null,
  fetched_at timestamptz not null default now(),
  primary key (series_id, season_number)
);

comment on table public.series_season_episode_counts is
  'Cache compartilhado: quantos episódios cada temporada de cada série tem, segundo o TMDB (`/tv/{id}/season/{n}`, campo `episodes.length`). Usado pelo emblema Temporada Concluída pra saber se uma temporada está 100% assistida. Populado (1) lazy, pela rota que já busca a temporada pra exibir na tela (PENDENTE — ver nota de implementação abaixo) e (2) pela Edge Function de enriquecimento, que passa a cobrir isto também. RLS sem nenhuma policy — só service role.';

alter table public.series_season_episode_counts enable row level security;

-- PENDENTE (próximo passo de implementação, fora desta migration) —
-- a rota em `apps/web` que já busca `/tv/{id}/season/{n}` do TMDB
-- (`lib/tmdb/client.ts`, as funções que montam `TmdbSeasonResponse`)
-- precisa passar a fazer um `upsert` aqui com `episodes.length`, como
-- efeito colateral da própria busca que já faz hoje — mesmo princípio
-- de "esquenta o cache pra todo mundo" de `media_summaries_cache`.
-- Esta migration só cria a tabela; o código que a alimenta ainda não
-- foi escrito nesta rodada.
