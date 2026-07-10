-- TASK-040 — "substituir biblioteca": antes de importar do TV Time,
-- apagar watch_progress/listas/favoritos/avaliações do usuário
-- ATUAL, mantendo perfil e configurações intocados.
--
-- Escopo do que é considerado "biblioteca" aqui (documentado pra
-- ficar claro o que foi incluído e o que foi deliberadamente
-- deixado de fora):
--   INCLUÍDO: watched_episodes, series_status, movie_status,
--   favorites, lists, list_items, reviews.
--   EXCLUÍDO DE PROPÓSITO: profiles (explicitamente pedido pra
--   manter), follows (grafo social, não é "biblioteca"),
--   notifications/content_reports (não são dados de biblioteca),
--   tvtime_import_snapshots/events/tvtime_tmdb_mappings
--   (infraestrutura técnica de importação, não dado do usuário).
--
--   comments e likes também ficaram FORA, e por um motivo
--   específico, não só "não é biblioteca": `comments.parent_comment_id`
--   tem `on delete cascade`. Apagar os comentários deste usuário
--   cascatearia e apagaria RESPOSTAS DE OUTROS USUÁRIOS a esses
--   comentários — dado de terceiros que não está (e não pode estar)
--   na foto deste usuário, logo não seria recuperável pelo
--   restore_user_library. "Avaliações" (reviews, nota numérica) não
--   tem esse risco — é só do próprio usuário, sem cascata pra
--   ninguém — por isso ficou dentro do escopo.
--
-- Sobre "transação": o corpo de uma função PL/pgSQL já é uma
-- transação implícita — se qualquer passo dentro de
-- wipe_user_library() falhar, o Postgres desfaz tudo sozinho, nada
-- fica parcialmente apagado. A parte que NÃO dá pra colocar dentro
-- dessa mesma transação é a importação em si (ela faz chamadas HTTP
-- ao TMDB, que não podem — e não devem — rodar dentro de uma
-- transação de banco). Por isso o desenho é: 1) capturar uma foto
-- completa da biblioteca atual (retornada como JSON), 2) apagar,
-- 3) rodar a importação normalmente, 4) se a importação falhar de
-- forma catastrófica (nenhuma série sequer foi gravada), o cliente
-- chama restore_user_library(foto) pra devolver tudo exatamente como
-- estava — o efeito prático de "nada foi apagado" é alcançado por
-- restauração, não por uma transação única cobrindo chamadas de
-- rede externas (o que não é seguro nem possível de verdade).

create or replace function public.wipe_user_library()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  snapshot jsonb;
begin
  if uid is null then
    raise exception 'Sem sessão — wipe_user_library exige usuário autenticado.';
  end if;

  select jsonb_build_object(
    'watched_episodes', coalesce((select jsonb_agg(to_jsonb(t)) from public.watched_episodes t where t.user_id = uid), '[]'::jsonb),
    'movie_status', coalesce((select jsonb_agg(to_jsonb(t)) from public.movie_status t where t.user_id = uid), '[]'::jsonb),
    'series_status', coalesce((select jsonb_agg(to_jsonb(t)) from public.series_status t where t.user_id = uid), '[]'::jsonb),
    'favorites', coalesce((select jsonb_agg(to_jsonb(t)) from public.favorites t where t.user_id = uid), '[]'::jsonb),
    'lists', coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at) from public.lists t where t.user_id = uid), '[]'::jsonb),
    'list_items', coalesce(
      (select jsonb_agg(to_jsonb(li) order by li.added_at)
       from public.list_items li
       join public.lists l on l.id = li.list_id
       where l.user_id = uid),
      '[]'::jsonb
    ),
    'reviews', coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at) from public.reviews t where t.user_id = uid), '[]'::jsonb)
  ) into snapshot;

  -- Ordem de exclusão respeita as FKs (filho antes do pai).
  delete from public.reviews where user_id = uid;
  delete from public.list_items where list_id in (select id from public.lists where user_id = uid);
  delete from public.lists where user_id = uid;
  delete from public.favorites where user_id = uid;
  delete from public.watched_episodes where user_id = uid;
  delete from public.series_status where user_id = uid;
  delete from public.movie_status where user_id = uid;

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
    raise exception 'Sem sessão — restore_user_library exige usuário autenticado.';
  end if;

  -- Ordem de inserção respeita as FKs (pai antes do filho) — o inverso exato da ordem de exclusão.
  insert into public.movie_status select * from jsonb_populate_recordset(null::public.movie_status, snapshot -> 'movie_status');
  insert into public.series_status select * from jsonb_populate_recordset(null::public.series_status, snapshot -> 'series_status');
  insert into public.watched_episodes select * from jsonb_populate_recordset(null::public.watched_episodes, snapshot -> 'watched_episodes');
  insert into public.favorites select * from jsonb_populate_recordset(null::public.favorites, snapshot -> 'favorites');
  insert into public.lists select * from jsonb_populate_recordset(null::public.lists, snapshot -> 'lists');
  insert into public.list_items select * from jsonb_populate_recordset(null::public.list_items, snapshot -> 'list_items');
  insert into public.reviews select * from jsonb_populate_recordset(null::public.reviews, snapshot -> 'reviews');
end;
$$;

revoke all on function public.wipe_user_library() from public;
grant execute on function public.wipe_user_library() to authenticated;
revoke all on function public.restore_user_library(jsonb) from public;
grant execute on function public.restore_user_library(jsonb) to authenticated;
