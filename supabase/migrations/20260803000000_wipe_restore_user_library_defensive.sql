create or replace function public.wipe_user_library()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  snapshot jsonb := '{}'::jsonb;
  part jsonb;
begin
  if uid is null then
    raise exception 'Sem sessao - wipe_user_library exige usuario autenticado.';
  end if;

  if to_regclass('public.watched_episodes') is not null then
    execute 'select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from public.watched_episodes t where t.user_id = $1'
      into part using uid;
    snapshot := snapshot || jsonb_build_object('watched_episodes', part);
    execute 'delete from public.watched_episodes where user_id = $1' using uid;
  end if;

  if to_regclass('public.movie_status') is not null then
    execute 'select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from public.movie_status t where t.user_id = $1'
      into part using uid;
    snapshot := snapshot || jsonb_build_object('movie_status', part);
    execute 'delete from public.movie_status where user_id = $1' using uid;
  end if;

  if to_regclass('public.series_status') is not null then
    execute 'select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from public.series_status t where t.user_id = $1'
      into part using uid;
    snapshot := snapshot || jsonb_build_object('series_status', part);
    execute 'delete from public.series_status where user_id = $1' using uid;
  end if;

  if to_regclass('public.favorites') is not null then
    execute 'select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from public.favorites t where t.user_id = $1'
      into part using uid;
    snapshot := snapshot || jsonb_build_object('favorites', part);
    execute 'delete from public.favorites where user_id = $1' using uid;
  end if;

  -- list_items depende de lists existir (FK) — só mexe se as duas existirem.
  if to_regclass('public.lists') is not null and to_regclass('public.list_items') is not null then
    execute 'select coalesce(jsonb_agg(to_jsonb(li) order by li.added_at), ''[]''::jsonb)
             from public.list_items li join public.lists l on l.id = li.list_id where l.user_id = $1'
      into part using uid;
    snapshot := snapshot || jsonb_build_object('list_items', part);
    execute 'delete from public.list_items where list_id in (select id from public.lists where user_id = $1)' using uid;
  end if;

  if to_regclass('public.lists') is not null then
    execute 'select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at), ''[]''::jsonb) from public.lists t where t.user_id = $1'
      into part using uid;
    snapshot := snapshot || jsonb_build_object('lists', part);
    execute 'delete from public.lists where user_id = $1' using uid;
  end if;

  if to_regclass('public.reviews') is not null then
    execute 'select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at), ''[]''::jsonb) from public.reviews t where t.user_id = $1'
      into part using uid;
    snapshot := snapshot || jsonb_build_object('reviews', part);
    execute 'delete from public.reviews where user_id = $1' using uid;
  end if;

  return snapshot;
end;
$$;

create or replace function public.restore_user_library(snapshot jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Sem sessao - restore_user_library exige usuario autenticado.';
  end if;

  if snapshot ? 'movie_status' and to_regclass('public.movie_status') is not null then
    insert into public.movie_status select * from jsonb_populate_recordset(null::public.movie_status, snapshot -> 'movie_status');
  end if;

  if snapshot ? 'series_status' and to_regclass('public.series_status') is not null then
    insert into public.series_status select * from jsonb_populate_recordset(null::public.series_status, snapshot -> 'series_status');
  end if;

  if snapshot ? 'watched_episodes' and to_regclass('public.watched_episodes') is not null then
    insert into public.watched_episodes select * from jsonb_populate_recordset(null::public.watched_episodes, snapshot -> 'watched_episodes');
  end if;

  if snapshot ? 'favorites' and to_regclass('public.favorites') is not null then
    insert into public.favorites select * from jsonb_populate_recordset(null::public.favorites, snapshot -> 'favorites');
  end if;

  if snapshot ? 'lists' and to_regclass('public.lists') is not null then
    insert into public.lists select * from jsonb_populate_recordset(null::public.lists, snapshot -> 'lists');
  end if;

  if snapshot ? 'list_items' and to_regclass('public.list_items') is not null then
    insert into public.list_items select * from jsonb_populate_recordset(null::public.list_items, snapshot -> 'list_items');
  end if;

  if snapshot ? 'reviews' and to_regclass('public.reviews') is not null then
    insert into public.reviews select * from jsonb_populate_recordset(null::public.reviews, snapshot -> 'reviews');
  end if;
end;
$$;

revoke all on function public.wipe_user_library() from public;
grant execute on function public.wipe_user_library() to authenticated;
revoke all on function public.restore_user_library(jsonb) from public;
grant execute on function public.restore_user_library(jsonb) to authenticated;
