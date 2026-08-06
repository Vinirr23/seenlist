-- CORREÇÃO da função criada em 20260824000000.
--
-- BUG REAL (visto no painel: funil e retenção 100% zerados, mesmo com
-- 381 usuários e centenas de milhares de episódios marcados): a
-- chave primária de `public.profiles` é `user_id`, NÃO `id` — a
-- versão anterior comparava `s.user_id = p.id`, e como `p.id` não
-- existe nessa tabela, todas as subconsultas `exists(...)` davam
-- falso. Resultado: funil mostrava "0 adicionaram título" mesmo com
-- biblioteca cheia, e retenção dava 0% em todas as janelas.
--
-- Só troca `p.id` por `p.user_id`; nenhuma outra regra mudou.

create or replace function public.get_observability_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  with
  cohort_d1 as (
    select
      count(*) as total,
      count(*) filter (
        where exists (
          select 1 from watched_episodes w
          where w.user_id = p.user_id
            and w.watched_at >= p.created_at + interval '1 day'
            and w.watched_at <  p.created_at + interval '2 days'
        )
      ) as retained
    from profiles p
    where p.created_at < now() - interval '2 days'
      and p.created_at > now() - interval '90 days'
  ),
  cohort_d7 as (
    select
      count(*) as total,
      count(*) filter (
        where exists (
          select 1 from watched_episodes w
          where w.user_id = p.user_id
            and w.watched_at >= p.created_at + interval '7 days'
            and w.watched_at <  p.created_at + interval '8 days'
        )
      ) as retained
    from profiles p
    where p.created_at < now() - interval '8 days'
      and p.created_at > now() - interval '90 days'
  ),
  cohort_d30 as (
    select
      count(*) as total,
      count(*) filter (
        where exists (
          select 1 from watched_episodes w
          where w.user_id = p.user_id
            and w.watched_at >= p.created_at + interval '30 days'
            and w.watched_at <  p.created_at + interval '31 days'
        )
      ) as retained
    from profiles p
    where p.created_at < now() - interval '31 days'
      and p.created_at > now() - interval '120 days'
  ),
  funnel as (
    select
      count(*) as signed_up,
      count(*) filter (
        where exists (select 1 from series_status s where s.user_id = p.user_id)
           or exists (select 1 from movie_status m where m.user_id = p.user_id)
      ) as added_first_title,
      count(*) filter (
        where exists (select 1 from watched_episodes w where w.user_id = p.user_id)
      ) as watched_first_episode,
      count(*) filter (
        where exists (
          select 1 from watched_episodes w
          where w.user_id = p.user_id
            and w.watched_at >= p.created_at + interval '1 day'
        )
      ) as came_back
    from profiles p
    where p.created_at > now() - interval '90 days'
  ),
  top_series as (
    select jsonb_agg(t) as items
    from (
      select series_id, count(*) as tracked
      from series_status
      where status <> 'removed'
      group by series_id
      order by count(*) desc
      limit 10
    ) t
  ),
  ratings as (
    select
      coalesce(avg(rating), 0)::numeric(3,2) as average,
      count(*) as total
    from reviews
    where deleted_at is null and rating is not null
  ),
  presence as (
    select
      count(distinct user_id) filter (where watched_at > now() - interval '5 minutes') as online_now,
      count(distinct user_id) filter (where watched_at > now() - interval '1 hour') as active_last_hour,
      max(watched_at) as last_activity_at
    from watched_episodes
    where watched_at > now() - interval '1 day'
  ),
  growth as (
    select
      count(*) filter (where created_at >= date_trunc('day', now())) as today,
      count(*) filter (where created_at > now() - interval '7 days') as week,
      count(*) filter (where created_at > now() - interval '30 days') as month
    from profiles
  ),
  -- CORREÇÃO (bug real, visto no painel: "MAU 773.480" com só 381
  -- usuários no total) — o painel contava LINHAS de
  -- `watched_episodes`, não pessoas distintas. Agora as contagens de
  -- "usuários ativos" saem daqui, com `count(distinct user_id)`, e
  -- não mais do lado do Next.js.
  active_users as (
    select
      count(distinct user_id) filter (where watched_at >= date_trunc('day', now())) as today,
      count(distinct user_id) filter (where watched_at > now() - interval '7 days') as week,
      count(distinct user_id) filter (where watched_at > now() - interval '30 days') as month
    from watched_episodes
    where watched_at > now() - interval '30 days'
  ),
  engagement as (
    select
      (select count(distinct user_id) from watched_episodes where watched_at > now() - interval '30 days') as active_users,
      (select count(*) from watched_episodes where watched_at > now() - interval '30 days') as episodes,
      (select count(*) from reviews where created_at > now() - interval '30 days' and deleted_at is null) as reviews,
      (select count(*) from comments where created_at > now() - interval '30 days' and deleted_at is null) as comments,
      (select count(*) from posts where created_at > now() - interval '30 days' and deleted_at is null) as posts
  )
  select jsonb_build_object(
    'retention', jsonb_build_object(
      'd1',  jsonb_build_object('total', c1.total,  'retained', c1.retained),
      'd7',  jsonb_build_object('total', c7.total,  'retained', c7.retained),
      'd30', jsonb_build_object('total', c30.total, 'retained', c30.retained)
    ),
    'funnel', jsonb_build_object(
      'signedUp', f.signed_up,
      'addedFirstTitle', f.added_first_title,
      'watchedFirstEpisode', f.watched_first_episode,
      'cameBack', f.came_back
    ),
    'topSeries', coalesce(ts.items, '[]'::jsonb),
    'ratings', jsonb_build_object('average', r.average, 'total', r.total),
    'presence', jsonb_build_object(
      'onlineNow', coalesce(pr.online_now, 0),
      'activeLastHour', coalesce(pr.active_last_hour, 0),
      'lastActivityAt', pr.last_activity_at
    ),
    'growth', jsonb_build_object('today', g.today, 'week', g.week, 'month', g.month),
    'activeUsers', jsonb_build_object('today', au.today, 'week', au.week, 'month', au.month),
    'engagement', jsonb_build_object(
      'activeUsers', e.active_users,
      'episodes', e.episodes,
      'reviews', e.reviews,
      'comments', e.comments,
      'posts', e.posts
    )
  )
  into result
  from cohort_d1 c1, cohort_d7 c7, cohort_d30 c30, funnel f, top_series ts, ratings r,
       presence pr, growth g, active_users au, engagement e;

  return result;
end;
$$;

revoke all on function public.get_observability_stats() from public;
revoke all on function public.get_observability_stats() from anon;
revoke all on function public.get_observability_stats() from authenticated;
