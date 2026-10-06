-- TASK: retomada da funcionalidade de lista compartilhada (2 pessoas),
-- pausada anteriormente e recomeçada do zero em 2026-10-06 (nenhum
-- vestígio do trabalho anterior foi encontrado em nenhuma migration,
-- doc de projeto ou no histórico desta sessão — ver
-- claude/SEENLIST-FEATURE-2026-10-06-lista-compartilhada.md).
--
-- Modelo escolhido pelo usuário (AskUserQuestion, confirmado, nenhuma
-- decisão grande tomada sozinho):
-- - Co-donos: sempre exatamente 1 convidado por lista (não um grupo).
-- - 2 colunas na própria tabela `lists` (não uma tabela nova) — mais
--   simples pra um caso que é sempre 1-pra-1.
-- - Convite por busca de username (reaproveita o mesmo mecanismo já
--   usado em "Recomendações") + notificação; convidado aceita/recusa.
-- - Co-dono tem direito igual sobre os ITENS (list_items): adicionar,
--   remover. NÃO tem direito sobre a lista em si — renomear ou apagar
--   a lista continua exclusivo do dono original.
-- - Dono pode remover o co-dono a qualquer momento (não só o próprio
--   co-dono saindo). Itens que o co-dono adicionou NÃO são removidos
--   quando ele sai/é removido — ficam na lista.
-- - Escopo: só "Minhas listas" (mobile). Biblioteca pessoal
--   (watched/want-to-watch) continua 100% individual, não afetada.

-- =====================================================================
-- 1. Colunas novas em `lists`
-- =====================================================================
alter table public.lists
  add column if not exists co_owner_id uuid references auth.users (id) on delete set null;

alter table public.lists
  add column if not exists co_owner_status text;

alter table public.lists
  drop constraint if exists lists_co_owner_status_check;
alter table public.lists
  add constraint lists_co_owner_status_check
  check (co_owner_status is null or co_owner_status in ('pending', 'accepted'));

-- Convite só faz sentido com os dois preenchidos ou os dois vazios —
-- nunca um id sem status ou um status sem id.
alter table public.lists
  drop constraint if exists lists_co_owner_pair_check;
alter table public.lists
  add constraint lists_co_owner_pair_check
  check ((co_owner_id is null) = (co_owner_status is null));

comment on column public.lists.co_owner_id is
  'Segunda pessoa convidada pra co-dona da lista (sempre no máximo 1). NULL = lista sem co-dono/convite.';
comment on column public.lists.co_owner_status is
  '''pending'' = convite enviado, aguardando resposta. ''accepted'' = convite aceito, co-dono tem direito igual sobre os ITENS da lista (não sobre a lista em si — renomear/apagar continua só do dono). NULL = sem convite ativo.';

create index if not exists lists_co_owner_idx on public.lists (co_owner_id) where co_owner_id is not null;

-- =====================================================================
-- 2. RLS de `lists`
-- =====================================================================

-- SELECT: dono original OU co-dono (pending ou accepted — precisa ver
-- a lista pra decidir aceitar/recusar o convite, não só depois de aceito).
drop policy if exists "usuário vê apenas as próprias listas" on public.lists;
drop policy if exists "dono ou co-dono vê a lista" on public.lists;
create policy "dono ou co-dono vê a lista"
  on public.lists for select
  using (auth.uid() = user_id or auth.uid() = co_owner_id);

-- INSERT: sem mudança de comportamento — só o dono cria lista.
drop policy if exists "usuário cria apenas a própria lista" on public.lists;
create policy "usuário cria apenas a própria lista"
  on public.lists for insert
  with check (auth.uid() = user_id);

-- UPDATE: permissiva a nível de RLS pros dois lados (dono e co-dono
-- convidado) — o controle fino de QUAIS colunas cada um pode mudar
-- fica no trigger abaixo, porque RLS (`with check`) não tem acesso
-- direto à linha ANTIGA pra comparar campo a campo.
drop policy if exists "usuário atualiza apenas a própria lista" on public.lists;
drop policy if exists "dono ou co-dono atualiza a lista" on public.lists;
create policy "dono ou co-dono atualiza a lista"
  on public.lists for update
  using (auth.uid() = user_id or auth.uid() = co_owner_id)
  with check (auth.uid() = user_id or auth.uid() = co_owner_id);

-- DELETE: sem mudança — só o dono original apaga a lista inteira
-- (decisão confirmada: co-dono não tem esse direito).
drop policy if exists "usuário remove apenas a própria lista" on public.lists;
create policy "usuário remove apenas a própria lista"
  on public.lists for delete
  using (auth.uid() = user_id);

-- Trigger: quando quem está atualizando é o CO-DONO (não o dono), só
-- permite duas transições e nada mais — nome, dono (`user_id`) e id
-- nunca podem mudar pela mão do co-dono:
--   a) aceitar o convite: pending -> accepted, mesmo co_owner_id.
--   b) recusar ou saír: zerar os dois campos (co_owner_id e
--      co_owner_status voltam a NULL).
-- Quando quem está atualizando é o DONO, nenhuma restrição aqui (ele
-- pode renomear, convidar, remover o co-dono, etc. — tudo dentro do
-- que as colunas/constraints já permitem).
create or replace function public.lists_restrict_co_owner_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.co_owner_id and (old.user_id is distinct from auth.uid()) then
    if new.user_id is distinct from old.user_id
       or new.name is distinct from old.name
       or new.id is distinct from old.id then
      raise exception 'co-dono não pode alterar nome, dono ou id da lista';
    end if;

    if not (
      -- aceitar convite pendente
      (old.co_owner_status = 'pending' and new.co_owner_status = 'accepted' and new.co_owner_id = old.co_owner_id)
      -- recusar ou saír da lista
      or (new.co_owner_id is null and new.co_owner_status is null)
    ) then
      raise exception 'co-dono só pode aceitar o convite ou saír da lista';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists lists_restrict_co_owner_update_trigger on public.lists;
create trigger lists_restrict_co_owner_update_trigger
  before update on public.lists
  for each row
  execute function public.lists_restrict_co_owner_update();

-- =====================================================================
-- 3. RLS de `list_items` — dono OU co-dono ACEITO (pending ainda não
--    tem direito sobre os itens, só depois de aceitar o convite).
-- =====================================================================

drop policy if exists "usuário vê itens apenas das próprias listas" on public.list_items;
drop policy if exists "dono ou co-dono vê os itens" on public.list_items;
create policy "dono ou co-dono vê os itens"
  on public.list_items for select
  using (exists (
    select 1 from public.lists l
    where l.id = list_items.list_id
      and (l.user_id = auth.uid() or (l.co_owner_id = auth.uid() and l.co_owner_status = 'accepted'))
  ));

drop policy if exists "usuário adiciona itens apenas nas próprias listas" on public.list_items;
drop policy if exists "dono ou co-dono adiciona itens" on public.list_items;
create policy "dono ou co-dono adiciona itens"
  on public.list_items for insert
  with check (exists (
    select 1 from public.lists l
    where l.id = list_items.list_id
      and (l.user_id = auth.uid() or (l.co_owner_id = auth.uid() and l.co_owner_status = 'accepted'))
  ));

drop policy if exists "usuário remove itens apenas das próprias listas" on public.list_items;
drop policy if exists "dono ou co-dono remove itens" on public.list_items;
create policy "dono ou co-dono remove itens"
  on public.list_items for delete
  using (exists (
    select 1 from public.lists l
    where l.id = list_items.list_id
      and (l.user_id = auth.uid() or (l.co_owner_id = auth.uid() and l.co_owner_status = 'accepted'))
  ));

-- =====================================================================
-- 4. Notificações — 4 tipos novos + target_type 'list'. As duas
--    constraints de check (`type`/`target_type`) são reescritas com a
--    lista COMPLETA de valores já existentes + os novos — nunca só o
--    valor novo, senão apaga o que outras migrations já adicionaram
--    (erro real já cometido e documentado antes neste mesmo projeto).
-- =====================================================================

alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type = any (array[
    'comment_reply', 'comment_like', 'review_like', 'episode_new', 'season_premiere',
    'recommendation', 'new_follower', 'feedback_reply', 'week_review', 'post_like',
    'new_feedback', 'verified_badge', 'verified_badge_granted',
    'list_coowner_invite', 'list_coowner_accepted', 'list_coowner_declined', 'list_coowner_removed', 'list_coowner_left'
  ]));

alter table public.notifications
  drop constraint if exists notifications_target_type_check;
alter table public.notifications
  add constraint notifications_target_type_check
  check (target_type = any (array[
    'comment', 'review', 'profile', 'series', 'movie', 'recommendation', 'user_feedback',
    'post', 'post_comment', 'list'
  ]));

do $$
begin
  alter publication supabase_realtime add table public.lists;
exception
  when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
