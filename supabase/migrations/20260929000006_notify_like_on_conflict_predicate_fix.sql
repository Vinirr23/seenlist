-- =====================================================================
-- BUG REAL, causado pela minha própria migration 20260929000004 —
-- "nada acontece" no web (voltou depois de eu achar ter corrigido) e
-- "marca e desmarca" no mobile, mesmo com TODAS as constraints
-- corretas (conferido direto no banco via pg_constraint antes de
-- escrever esta migration — likes_target_type_check,
-- notifications_target_type_check e notifications_type_check já
-- tinham 'post'/'post_like' certinho).
--
-- CAUSA RAIZ: o índice `notifications_group_unread_idx`
-- (20260903000000, estendido em 20260929000002) tem DUAS condições no
-- WHERE:
--   where read_at is null and type = any (array['comment_like', 'review_like', 'post_like'])
-- A cláusula `ON CONFLICT (...) WHERE ...` que escrevi em
-- 20260929000004 só tinha a primeira condição (`where read_at is
-- null`), sem a segunda. O Postgres exige que o predicado do ON
-- CONFLICT bata EXATAMENTE (mesma expressão) com o predicado de um
-- índice único existente pra poder usá-lo como "árbitro" — se não
-- bate, todo INSERT que usa esse ON CONFLICT falha na hora com erro
-- 42P10 ("no unique or exclusion constraint matching the ON CONFLICT
-- specification"), MESMO quando não existe conflito nenhum ainda
-- (falha na resolução do plano, não na checagem de duplicata em si).
-- Ou seja: TODA curtida (comment/review/post) parou de funcionar
-- desde que 20260929000004 rodou — o "AFTER INSERT" em `likes`
-- desfazia a curtida inteira, igual aos bugs anteriores.
--
-- Corrigido repetindo o predicado do índice, palavra por palavra, no
-- ON CONFLICT.
-- =====================================================================

create or replace function public.notify_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  notif_type text;
  media_type_val text;
  media_id_val integer;
  wants_it boolean;
begin
  if new.target_type = 'comment' then
    select user_id, media_type, media_id into owner_id, media_type_val, media_id_val
      from public.comments where id = new.target_id;
    notif_type := 'comment_like';
  elsif new.target_type = 'review' then
    select user_id, media_type, media_id into owner_id, media_type_val, media_id_val
      from public.reviews where id = new.target_id;
    notif_type := 'review_like';
  elsif new.target_type = 'post' then
    select user_id, media_type, media_id into owner_id, media_type_val, media_id_val
      from public.posts where id = new.target_id;
    notif_type := 'post_like';
  else
    return new; -- 'list' / 'post_comment' — sem tipo de notificação equivalente ainda
  end if;

  if owner_id is null or owner_id = new.user_id then
    return new;
  end if;

  if notif_type = 'comment_like' then
    select coalesce(comment_like, true) into wants_it from public.notification_preferences where user_id = owner_id;
  elsif notif_type = 'review_like' then
    select coalesce(review_like, true) into wants_it from public.notification_preferences where user_id = owner_id;
  else
    select coalesce(post_like, true) into wants_it from public.notification_preferences where user_id = owner_id;
  end if;
  if wants_it is false then
    return new;
  end if;

  insert into public.notifications (
    user_id, actor_id, type, target_type, target_id,
    target_media_type, target_media_id, group_count
  )
  values (
    owner_id, new.user_id, notif_type, new.target_type, new.target_id,
    media_type_val, media_id_val, 1
  )
  on conflict (user_id, type, target_id) where read_at is null and type = any (array['comment_like', 'review_like', 'post_like'])
  do update set
    actor_id = excluded.actor_id,
    group_count = public.notifications.group_count + 1,
    created_at = now(),
    pushed_at = null;

  return new;
end;
$$;

notify pgrst, 'reload schema';
