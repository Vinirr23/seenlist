-- =====================================================================
-- Continuação de 20260929000002_post_like_notifications.sql — agora
-- que a definição REAL de `notify_like()` foi conferida em produção
-- (`select pg_get_functiondef('public.notify_like'::regproc)`, rodado
-- pelo usuário) e bate exatamente com o que já estava no arquivo da
-- migration 20260915010000 (sem nenhuma lógica extra de agrupamento/
-- upsert escondida só em produção) — seguro substituir.
--
-- Acrescenta só o `elsif` pra `target_type = 'post'`, no mesmo padrão
-- exato de 'comment'/'review'. `target_type = 'post_comment'` (curtida
-- num comentário de post) continua caindo no 'else' — mesma lacuna,
-- fora do pedido original ("curti um POST"), registrada como
-- pendência separada, não implementada aqui.
--
-- OBSERVAÇÃO À PARTE (achado investigando, não é bug novo desta
-- entrega): o índice `notifications_group_unread_idx` (único, sem
-- `ON CONFLICT` correspondente no INSERT desta função) significa que
-- duas pessoas diferentes curtindo o MESMO alvo enquanto a notificação
-- anterior ainda está não lida vai colidir nesse índice único e a
-- função vai lançar erro — o que (por estar num trigger AFTER INSERT)
-- desfaz a curtida inteira, não só a notificação. Isso já valia pra
-- comment_like/review_like antes desta migration; 'post_like' herda o
-- mesmo comportamento por consistência, sem tentar consertar isso
-- aqui — é uma decisão maior, separada, fica registrada pra decidir
-- depois se quiser.
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
    target_media_type, target_media_id
  )
  values (
    owner_id, new.user_id, notif_type, new.target_type, new.target_id,
    media_type_val, media_id_val
  );

  return new;
end;
$$;

notify pgrst, 'reload schema';
