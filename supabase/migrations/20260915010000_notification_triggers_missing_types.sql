-- =====================================================================
-- TASK — sino de notificações no Perfil (web + mobile), a pedido do
-- usuário (2026-09-15). Investigação prévia encontrou que a tabela
-- `notifications` (20260731000000_social_layer_comments_reviews_likes.sql)
-- já previa 4 tipos (comment_reply, comment_like, review_like,
-- new_follower), mas só 'recommendation' (20260820000000) e
-- episode_new/season_premiere (Edge Function check-new-releases)
-- realmente geravam uma linha. NENHUM gatilho existia pra
-- comment_reply/comment_like/new_follower — checado exaustivamente
-- (busca por cada tipo em todo o repositório: só apareciam no CHECK
-- da tabela e no envio de push genérico, nunca num INSERT). Esta
-- migration cria os 3 gatilhos que faltam, seguindo o mesmo padrão
-- já usado por notify_recommendation (SECURITY DEFINER, pra poder
-- inserir notificação em nome de outro usuário — a policy de INSERT
-- da tabela não libera isso pra usuário comum).
--
-- BUG PRÉ-EXISTENTE encontrado ao investigar (corrigido junto): a
-- migration 20260820000000 recriou `notifications_type_check` pra
-- acrescentar 'recommendation', mas ESQUECEU 'new_follower' (que a
-- migration original, 20260731000000, já permitia) — nenhuma
-- notificação desse tipo teria passado pelo CHECK desde então, mesmo
-- se algo tentasse inserir uma.
-- =====================================================================

-- 1. Restaura 'new_follower' na constraint (bug pré-existente, ver acima) — 7 tipos agora.
alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type = any (array['comment_reply', 'comment_like', 'review_like', 'episode_new', 'season_premiere', 'recommendation', 'new_follower']));

-- 2. Preferência por tipo pra "novo seguidor" — mesmo padrão nullable
-- das outras colunas de `notification_preferences` (nula = ligado por
-- padrão, `coalesce(new_follower, true)` nos triggers).
alter table public.notification_preferences
  add column if not exists new_follower boolean;

-- =====================================================================
-- 3. RESPOSTA A COMENTÁRIO — notifica o autor do comentário PAI,
-- nunca a si mesmo (resposta ao próprio comentário não notifica).
-- target_media_type/target_media_id vêm do comentário NOVO (mesma
-- mídia do pai sempre — uma resposta não muda de mídia), pra dar um
-- link de volta pro título mesmo sem UI de "ir até o comentário
-- exato" (fora do escopo desta entrega).
-- =====================================================================
create or replace function public.notify_comment_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_author uuid;
  wants_it boolean;
begin
  if new.parent_comment_id is null then
    return new;
  end if;

  select user_id into parent_author from public.comments where id = new.parent_comment_id;
  if parent_author is null or parent_author = new.user_id then
    return new;
  end if;

  select coalesce(comment_reply, true) into wants_it
    from public.notification_preferences where user_id = parent_author;
  if wants_it is false then
    return new;
  end if;

  insert into public.notifications (
    user_id, actor_id, type, target_type, target_id,
    target_media_type, target_media_id
  )
  values (
    parent_author, new.user_id, 'comment_reply', 'comment', new.id,
    new.media_type, new.media_id
  );

  return new;
end;
$$;

drop trigger if exists on_comment_insert_notify_reply on public.comments;
create trigger on_comment_insert_notify_reply
  after insert on public.comments
  for each row execute function public.notify_comment_reply();

-- =====================================================================
-- 4. CURTIDA EM COMENTÁRIO/REVIEW — notifica o dono do alvo curtido,
-- nunca a si mesmo. `likes.target_type` também aceita 'list', que não
-- tem tipo de notificação equivalente ainda (ignorado de propósito,
-- não é um erro).
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
  else
    return new; -- 'list' — sem tipo de notificação equivalente
  end if;

  if owner_id is null or owner_id = new.user_id then
    return new;
  end if;

  if notif_type = 'comment_like' then
    select coalesce(comment_like, true) into wants_it from public.notification_preferences where user_id = owner_id;
  else
    select coalesce(review_like, true) into wants_it from public.notification_preferences where user_id = owner_id;
  end if;
  if wants_it is false then
    return new;
  end if;

  insert into public.notifications (
    user_id, actor_id, type, target_type, target_id,
    target_media_type, target_media_id
  )
  values (
    owner_id, new.user_id, notif_type, new.target_type, new.target_id,
    media_type_val, media_id_val
  );

  return new;
end;
$$;

drop trigger if exists on_like_insert_notify on public.likes;
create trigger on_like_insert_notify
  after insert on public.likes
  for each row execute function public.notify_like();

-- =====================================================================
-- 5. NOVO SEGUIDOR — `target_id` aponta pro `user_id` de quem seguiu
-- (mesmo valor de `actor_id` aqui; guardado nos dois pra a UI genérica
-- de notificações não precisar de um caso especial só pra este tipo).
-- =====================================================================
create or replace function public.notify_new_follower()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wants_it boolean;
begin
  select coalesce(new_follower, true) into wants_it
    from public.notification_preferences where user_id = new.following_id;
  if wants_it is false then
    return new;
  end if;

  insert into public.notifications (user_id, actor_id, type, target_type, target_id)
  values (new.following_id, new.follower_id, 'new_follower', 'profile', new.follower_id);

  return new;
end;
$$;

drop trigger if exists on_follow_insert_notify on public.follows;
create trigger on_follow_insert_notify
  after insert on public.follows
  for each row execute function public.notify_new_follower();

notify pgrst, 'reload schema';
