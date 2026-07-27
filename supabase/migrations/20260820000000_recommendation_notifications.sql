-- =====================================================================
-- TASK-191 — Recomendação recebida nunca gerava notificação/push,
-- só aparecia dentro do app (achado real, reportado: usuário mandou
-- recomendação de teste e nenhum push chegou). Mesmo padrão dos
-- triggers já existentes (notify_comment_reply, notify_like, ambos
-- em 20260731000000_social_layer_comments_reviews_likes.sql) —
-- SECURITY DEFINER pra poder inserir em `notifications` em nome de
-- outro usuário (RLS da tabela só libera leitura da própria caixa).
--
-- Nota: as colunas usadas aqui (target_media_type, target_media_id,
-- payload, pushed_at) e as duas constraints alteradas abaixo já
-- existem no banco de produção, aplicadas em algum momento anterior
-- sem uma migration correspondente salva no repositório — checado
-- direto no banco antes de escrever isto, não assumido pelos
-- arquivos daqui. Esta migration só ACRESCENTA 'recommendation' ao
-- que já existe, não recria nada do zero.
-- =====================================================================

-- 1. Preferência de notificação por tipo, mesmo padrão de
-- comment_reply/comment_like/review_like/episode_new/season_premiere
-- (nullable — `coalesce(recommendation, true)` no trigger abaixo
-- decide o padrão "notifica a menos que a pessoa tenha desativado
-- explicitamente").
alter table public.notification_preferences
  add column if not exists recommendation boolean;

-- 2. 'recommendation' precisa ser um `type` e um `target_type`
-- válidos pra passar pelo CHECK da tabela.
alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type = any (array['comment_reply', 'comment_like', 'review_like', 'episode_new', 'season_premiere', 'recommendation']));

alter table public.notifications
  drop constraint if exists notifications_target_type_check;
alter table public.notifications
  add constraint notifications_target_type_check
  check (target_type = any (array['comment', 'review', 'profile', 'series', 'movie', 'recommendation']));

-- 3. Trigger — dispara ao inserir em `recommendations` (já garante
-- sender_id <> recipient_id via CHECK própria da tabela, então não
-- precisa do guard "não notifica a si mesmo" que comment/like têm).
-- `target_id` aponta pra própria linha de `recommendations` (pra um
-- futuro "marcar como lida a partir da notificação", se um dia
-- existir uma caixa de notificações genérica no app). A mensagem
-- curta opcional do remetente vai em `payload`, pro push poder
-- mostrar ela.
create or replace function public.notify_recommendation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wants_it boolean;
begin
  select coalesce(recommendation, true) into wants_it
    from public.notification_preferences where user_id = new.recipient_id;

  if wants_it is false then
    return new;
  end if;

  insert into public.notifications (
    user_id, actor_id, type, target_type, target_id,
    target_media_type, target_media_id, payload
  )
  values (
    new.recipient_id,
    new.sender_id,
    'recommendation',
    'recommendation',
    new.id,
    new.media_type,
    new.media_id,
    case when new.message is not null then jsonb_build_object('message', new.message) else null end
  );

  return new;
end;
$$;

drop trigger if exists on_recommendation_insert_notify on public.recommendations;
create trigger on_recommendation_insert_notify
  after insert on public.recommendations
  for each row execute function public.notify_recommendation();

notify pgrst, 'reload schema';
