-- CORREÇÃO (achado em auditoria — "verifique toda a lógica de
-- status", 2026-08-22) — `get_watched_episode_stats` já existe e está
-- em uso em produção (referenciada em
-- `apps/web/lib/queries/library-state.ts`, comentário aponta as
-- migrations originais `20260822000000` + correção `20260822000100`),
-- mas nenhuma dessas duas migrations está neste repositório — a
-- função só existia "invisível" dentro do banco, fora do controle de
-- versão. Esta migration recupera a definição atual (lida direto do
-- banco via `pg_get_functiondef`) pra fechar essa lacuna, sem inventar
-- o histórico perdido das duas migrations originais.
--
-- Confirmado nesta auditoria: a função já filtra `is_special = false`
-- corretamente (mesma regra usada em toda outra contagem de
-- "assistidos" do projeto) — não precisa de nenhuma correção de
-- comportamento, só de ficar visível em version control.
--
-- `create or replace` — rodar esta migration num banco que já tem a
-- função (produção) é uma operação inofensiva (mesma definição);
-- rodar num banco que não tem (ambiente novo/de teste) cria a função
-- pela primeira vez.
create or replace function public.get_watched_episode_stats(p_user_id uuid)
returns table(series_id integer, watched_count bigint, last_watched_at timestamp with time zone)
language sql
stable
set search_path to 'public'
as $function$
  select
    series_id,
    count(*) as watched_count,
    max(watched_at) as last_watched_at
  from public.watched_episodes
  where user_id = p_user_id
    and is_special = false
  group by series_id;
$function$;

revoke all on function public.get_watched_episode_stats(uuid) from public;
grant execute on function public.get_watched_episode_stats(uuid) to authenticated;
