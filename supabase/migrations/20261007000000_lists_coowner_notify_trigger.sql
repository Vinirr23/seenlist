-- =====================================================================
-- Correção de causa raiz — convite de co-dono falhava sempre
-- ("Não foi possível enviar o convite agora", e na 2ª tentativa pro
-- mesmo usuário já dava "Esta lista já tem um convite ativo", prova de
-- que o UPDATE em `lists` tinha mesmo funcionado na 1ª tentativa).
--
-- Causa: as 5 funções de co-dono em lib/lists.ts (inviteCoOwner,
-- acceptCoOwnerInvite, declineCoOwnerInvite, leaveSharedList,
-- removeCoOwner) inseriam a notificação DIRETO pelo client
-- (`supabase.from("notifications").insert(...)`), em nome de outra
-- pessoa. A RLS de `notifications` só libera cada usuário ler/escrever
-- a própria caixa — nunca inserir notificação pra outro user_id. O
-- insert sempre caía, silenciosamente mal reportado como erro genérico
-- no client.
--
-- Mesma causa, mesma receita já usada no resto do app pra notificar
-- OUTRA pessoa a partir de uma ação (ver comentário em
-- 20260820000000_recommendation_notifications.sql e o trigger
-- notify_comment_reply/notify_like em
-- 20260731000000_social_layer_comments_reviews_likes.sql): um trigger
-- SECURITY DEFINER no banco, que tem permissão de ignorar a RLS,
-- dispara a notificação certa a partir da própria transição de
-- estado — nunca um insert direto do client.
--
-- Este trigger cobre as 5 transições de co_owner_id/co_owner_status
-- que `lists_restrict_co_owner_update()` (20261006000001_lists_co_owner.sql)
-- já valida/permite, usando a mesma lógica de "quem é auth.uid()" pra
-- decidir qual notificação emitir e pra quem. As 5 funções client-side
-- passaram a fazer só o UPDATE em `lists` (ver lib/lists.ts) — a
-- notificação não é mais responsabilidade do client.
-- =====================================================================

create or replace function public.lists_notify_coowner_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 1. Convite enviado: dono setou co_owner_id (estava null) com status pending.
  if old.co_owner_id is null and new.co_owner_id is not null and new.co_owner_status = 'pending' then
    insert into public.notifications (user_id, actor_id, type, target_type, target_id, payload)
    values (new.co_owner_id, auth.uid(), 'list_coowner_invite', 'list', new.id, jsonb_build_object('listName', new.name));

  -- 2. Convite aceito: pending -> accepted (só o próprio convidado pode fazer essa transição).
  elsif old.co_owner_status = 'pending' and new.co_owner_status = 'accepted' then
    insert into public.notifications (user_id, actor_id, type, target_type, target_id, payload)
    values (new.user_id, auth.uid(), 'list_coowner_accepted', 'list', new.id, jsonb_build_object('listName', new.name));

  -- 3. Convite recusado: pending -> (null, null), quem agiu foi o convidado.
  elsif old.co_owner_status = 'pending' and new.co_owner_id is null and auth.uid() = old.co_owner_id then
    insert into public.notifications (user_id, actor_id, type, target_type, target_id, payload)
    values (new.user_id, auth.uid(), 'list_coowner_declined', 'list', new.id, jsonb_build_object('listName', new.name));

  -- 4. Co-dono saiu por conta própria: accepted -> (null, null), quem agiu foi o próprio co-dono.
  elsif old.co_owner_status = 'accepted' and new.co_owner_id is null and auth.uid() = old.co_owner_id then
    insert into public.notifications (user_id, actor_id, type, target_type, target_id, payload)
    values (new.user_id, auth.uid(), 'list_coowner_left', 'list', new.id, jsonb_build_object('listName', new.name));

  -- 5. Dono removeu o co-dono (pending ou accepted, não importa): quem agiu foi o dono original.
  elsif old.co_owner_id is not null and new.co_owner_id is null and auth.uid() = old.user_id then
    insert into public.notifications (user_id, actor_id, type, target_type, target_id, payload)
    values (old.co_owner_id, auth.uid(), 'list_coowner_removed', 'list', new.id, jsonb_build_object('listName', new.name));
  end if;

  return new;
end;
$$;

drop trigger if exists on_lists_update_notify_coowner on public.lists;
create trigger on_lists_update_notify_coowner
  after update on public.lists
  for each row
  when (old.co_owner_id is distinct from new.co_owner_id or old.co_owner_status is distinct from new.co_owner_status)
  execute function public.lists_notify_coowner_events();

notify pgrst, 'reload schema';
