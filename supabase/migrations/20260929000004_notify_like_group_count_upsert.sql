-- =====================================================================
-- BUG REAL, achado testando a correção anterior (post_like) — "curti,
-- descurti, curti de novo" e a segunda curtida não fazia nada. Causa
-- raiz: `notify_like()` sempre fazia um INSERT simples em
-- `notifications`, mas existe um índice ÚNICO parcial
-- (`notifications_group_unread_idx`, em `user_id, type, target_id`
-- WHERE `read_at is null`) desde 20260903000000 — pensado pra dar
-- suporte a "N pessoas curtiram", mas NUNCA existiu o `ON CONFLICT`
-- correspondente em nenhuma versão da função (confirmado lendo a
-- definição real em produção, idêntica ao arquivo de migration). Ou
-- seja: sempre que a MESMA pessoa curtia de novo o mesmo alvo (depois
-- de descurtir) enquanto a notificação anterior seguia não lida, ou
-- quando DUAS pessoas diferentes curtiam o mesmo alvo não lido, o
-- INSERT colidia com o índice único, a função estourava erro, e por
-- estar num trigger AFTER INSERT em `likes`, isso desfazia a curtida
-- INTEIRA (rollback da transação toda) — sem nenhum aviso de erro pro
-- usuário. Já valia pra comment_like/review_like desde sempre; só foi
-- notado agora ao testar post_like.
--
-- Corrigido com `INSERT ... ON CONFLICT (...) WHERE read_at is null
-- DO UPDATE`: reaproveita a notificação não lida existente em vez de
-- tentar inserir outra — incrementa `group_count` de verdade (a
-- coluna já existia e já era lida por `send-push-notifications`,
-- mas nunca tinha sido incrementada por ninguém), atualiza
-- `actor_id` pra quem curtiu por último, `created_at` pra agora
-- (sobe a notificação pro topo da lista) e zera `pushed_at` (pra o
-- push seguinte já sair com o group_count atualizado).
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
  on conflict (user_id, type, target_id) where read_at is null
  do update set
    actor_id = excluded.actor_id,
    group_count = public.notifications.group_count + 1,
    created_at = now(),
    pushed_at = null;

  return new;
end;
$$;

notify pgrst, 'reload schema';
