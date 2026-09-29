-- =====================================================================
-- TASK — notificação de feedback novo pro admin (a pedido, 2026-09-29).
-- Até aqui `user_feedback` só tinha o caminho contrário (o USUÁRIO é
-- notificado quando você responde, ver
-- 20260916000000_feedback_replies.sql) — quando alguém MANDA um
-- feedback novo, ninguém era avisado dentro do app; a única forma de
-- saber era abrir a tabela direto no Supabase (Table Editor/SQL
-- Editor, como a própria migration original documentava).
--
-- Decisões confirmadas com o usuário (AskUserQuestion, 2026-09-29):
--   - Destinatário: a conta 'seenlistapp' (mesma que recebeu o selo
--     dourado nesta sessão), resolvida por USERNAME dentro da função
--     — não por UUID fixo copiado/colado, pra não arriscar guardar o
--     id errado sem checagem nenhuma.
--   - Canal: só notificação dentro do app (sino/lista) — SEM push por
--     enquanto. Push depende da Edge Function `send-push-notifications`,
--     cujo redeploy está pausado numa frente separada (a pedido do
--     usuário) — nada aqui depende disso nem precisa mudar quando
--     aquele redeploy acontecer.
--   - Ao tocar na notificação: NÃO navega — não existe tela de admin
--     pra listar feedback ainda (fora do escopo desta entrega, o
--     usuário decidiu não criar agora). Front-end não precisa de
--     nenhum `case` novo em getNotificationHref/getNotificationRoute —
--     o fallback padrão (sem mediaType/mediaId) já retorna null.
--
-- Tipo novo 'new_feedback' — lista base conferida na última migration
-- que tocou essa constraint (20260929000002_post_like_notifications.sql,
-- 10 tipos), só acrescentando 'new_feedback' como décimo primeiro.
-- `target_type = 'user_feedback'` já era permitido desde
-- 20260916000000 (a notificação de RESPOSTA de feedback usa o mesmo
-- valor) — nenhuma mudança necessária em notifications_target_type_check.
-- =====================================================================

alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type = any (array['comment_reply', 'comment_like', 'review_like', 'episode_new', 'season_premiere', 'recommendation', 'new_follower', 'feedback_reply', 'week_review', 'post_like', 'new_feedback']));

-- Preferência por tipo — mesmo padrão nullable das demais colunas de
-- `notification_preferences` em toda a base (nula = ligado por
-- padrão, `coalesce(new_feedback, true)` no trigger abaixo). Só tem
-- efeito prático pra quem for o admin, mas segue o padrão já
-- estabelecido em vez de abrir uma exceção só pra este tipo.
alter table public.notification_preferences
  add column if not exists new_feedback boolean;

-- `payload.message` guarda um preview do texto do feedback (até 140
-- caracteres) — os outros tipos de notificação nesta tabela sempre
-- linkam pra algo que já tem conteúdo pra mostrar (post, comentário,
-- título); este não tem NADA pra mostrar sem abrir o Supabase, e como
-- a decisão foi "não navega", o preview é a única forma do admin saber
-- do que se trata sem sair do app. `kind` guarda o tipo escolhido no
-- formulário (bug/suggestion/other) pra uso futuro, mesmo sem UI ainda
-- pra exibir isso.
create or replace function public.notify_new_feedback()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_id uuid;
  wants_it boolean;
  preview text;
begin
  select user_id into admin_id from public.profiles where username = 'seenlistapp';

  -- Sem conta admin com esse username, ou o próprio admin mandando
  -- feedback (não notifica a si mesmo, mesmo padrão de notify_like/
  -- notify_comment_reply) — não faz nada.
  if admin_id is null or admin_id = new.user_id then
    return new;
  end if;

  select coalesce(new_feedback, true) into wants_it
    from public.notification_preferences where user_id = admin_id;
  if wants_it is false then
    return new;
  end if;

  preview := left(new.message, 140);

  insert into public.notifications (
    user_id, actor_id, type, target_type, target_id, payload
  )
  values (
    admin_id, new.user_id, 'new_feedback', 'user_feedback', new.id,
    jsonb_build_object('message', preview, 'kind', new.type)
  );

  return new;
end;
$$;

drop trigger if exists on_user_feedback_insert_notify on public.user_feedback;
create trigger on_user_feedback_insert_notify
  after insert on public.user_feedback
  for each row execute function public.notify_new_feedback();

notify pgrst, 'reload schema';
