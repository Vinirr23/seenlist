-- A PEDIDO — "Seu ano": selo de "Top X%" precisa comparar a
-- atividade da pessoa com a de TODO MUNDO no ano, o que RLS bloqueia
-- de propósito no client (cada usuário só vê as próprias linhas).
-- `security definer` roda com privilégio elevado, mas só DEVOLVE o
-- percentual agregado — nunca uma linha de outro usuário.
--
-- Métrica: contagem de episódios + filmes assistidos no ano (não
-- minutos) — de propósito. Duração/runtime só existe no TMDB, fora
-- do banco; calcular "minutos" pra todo mundo exigiria uma chamada
-- externa por usuário, inviável dentro de uma função SQL. Contagem
-- de atividade já é um proxy razoável e é 100% calculável só com o
-- que já está no banco.

create or replace function get_year_activity_percentile(p_year int)
returns numeric
language sql
security definer
set search_path = public
stable
as $$
  with year_bounds as (
    select
      make_timestamptz(p_year, 1, 1, 0, 0, 0, 'UTC') as start_ts,
      make_timestamptz(p_year + 1, 1, 1, 0, 0, 0, 'UTC') as end_ts
  ),
  activity as (
    select user_id, watched_at as ts from watched_episodes where is_special = false
    union all
    select user_id, updated_at as ts from movie_status where status = 'completed'
  ),
  activity_per_user as (
    select activity.user_id, count(*) as activity_count
    from activity, year_bounds
    where activity.ts >= year_bounds.start_ts and activity.ts < year_bounds.end_ts
    group by activity.user_id
  ),
  ranked as (
    select user_id, activity_count, percent_rank() over (order by activity_count) as pct_rank
    from activity_per_user
  )
  select round((1 - coalesce((select pct_rank from ranked where user_id = auth.uid()), 1)) * 100)
$$;

-- Qualquer usuário autenticado pode chamar — a função em si só
-- devolve UM número (o percentual dele), nunca dado de outra pessoa.
grant execute on function get_year_activity_percentile(int) to authenticated;
