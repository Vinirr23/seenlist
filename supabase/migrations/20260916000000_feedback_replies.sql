-- =====================================================================
-- TASK — resposta a feedback (a pedido, 2026-09-15/16). Até aqui
-- `user_feedback` só tinha INSERT — nem o próprio usuário conseguia
-- ler de volta o que mandou, e não existia coluna nenhuma pra guardar
-- uma resposta. Você respondia?? Não tinha como: nem coluna, nem
-- jeito do usuário saber que a mensagem dele foi vista.
--
-- Esta migration:
--   1. Acrescenta `admin_reply`/`admin_replied_at` em `user_feedback`
--      (continua só você escrevendo ali, direto pelo Supabase — Table
--      Editor ou SQL Editor, com a service role, que ignora RLS).
--   2. Dá ao usuário uma policy de SELECT pra ler o PRÓPRIO feedback
--      (não existia nenhuma — só INSERT), pra poder mostrar o
--      histórico + resposta na tela "Enviar feedback".
--   3. Gatilho que, quando `admin_reply` é preenchido/alterado, grava
--      `admin_replied_at` sozinho e insere uma notificação pro
--      usuário — reaproveita a infraestrutura de notificações que
--      acabou de ser criada (20260915010000). Tipo novo:
--      'feedback_reply'. `target_type` também precisa de um valor
--      novo ('user_feedback') — a constraint original só permitia
--      'comment'/'review'/'profile'.
-- =====================================================================

alter table public.user_feedback
  add column if not exists admin_reply text,
  add column if not exists admin_replied_at timestamptz;

drop policy if exists "usuário lê o próprio feedback" on public.user_feedback;
create policy "usuário lê o próprio feedback"
  on public.user_feedback for select
  using (auth.uid() = user_id);

-- 'feedback_reply' novo na lista de tipos — 8 agora.
alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type = any (array['comment_reply', 'comment_like', 'review_like', 'episode_new', 'season_premiere', 'recommendation', 'new_follower', 'feedback_reply']));

-- 'user_feedback' novo na lista de target_type. CUIDADO (achado ao
-- rodar de verdade, 2026-09-16): a constraint original (20260731000000)
-- só previa 'comment'/'review'/'profile', mas 20260820000000 já tinha
-- ampliado pra 'series'/'movie'/'recommendation' (recomendação/episódio
-- novo) — reescrever a partir só da versão original derrubaria essas
-- linhas já existentes na validação do ALTER TABLE. Lista completa,
-- preservando tudo que já era permitido.
alter table public.notifications
  drop constraint if exists notifications_target_type_check;
alter table public.notifications
  add constraint notifications_target_type_check
  check (target_type = any (array['comment', 'review', 'profile', 'series', 'movie', 'recommendation', 'user_feedback']));

create or replace function public.notify_feedback_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.admin_reply is not null and new.admin_reply is distinct from old.admin_reply then
    new.admin_replied_at := now();

    insert into public.notifications (user_id, actor_id, type, target_type, target_id)
    values (new.user_id, null, 'feedback_reply', 'user_feedback', new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists on_feedback_reply_notify on public.user_feedback;
create trigger on_feedback_reply_notify
  before update on public.user_feedback
  for each row execute function public.notify_feedback_reply();

notify pgrst, 'reload schema';
