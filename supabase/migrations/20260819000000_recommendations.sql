-- =====================================================================
-- TASK-169 — Recomendar filme/série pra quem você segue.
--
-- Decisões confirmadas com o usuário antes de escrever isto:
--   - Só pode recomendar pra quem VOCÊ segue (não precisa ser mútuo).
--   - Mensagem curta opcional junto da recomendação.
--   - Bloqueio de usuário já no v1 (evitar spam de recomendação
--     indesejada).
--   - Sem chat livre — é só "manda o título, a pessoa recebe um
--     aviso e abre".
-- =====================================================================

-- =====================================================================
-- blocked_users — quem bloqueou quem. Único uso hoje: impedir
-- recomendação de quem foi bloqueado (a policy de INSERT de
-- `recommendations`, abaixo, consulta esta tabela). Reaproveitável
-- no futuro pra qualquer outra coisa que precise respeitar bloqueio
-- (comentário, seguir, etc.) — não construído agora, só a base.
-- =====================================================================
create table public.blocked_users (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.blocked_users enable row level security;

-- Duas policies de SELECT de propósito, não uma:
--   1. Dono vê a PRÓPRIA lista de bloqueios (pra gerenciar/desbloquear).
--   2. Achado real ao desenhar isto — sem esta segunda, a policy de
--      INSERT de `recommendations` (que precisa checar "o destinatário
--      me bloqueou?") NUNCA enxergaria a linha: RLS se aplica de novo
--      dentro da subconsulta, usando o auth.uid() de quem está
--      inserindo (o remetente) — e a policy 1 sozinha só libera
--      `blocker_id = auth.uid()`, nunca bate com a consulta
--      `blocker_id = destinatário`. Com a policy 2, o remetente
--      consegue ver especificamente as linhas em que ELE é o
--      bloqueado (`blocked_id = auth.uid()`) — exatamente o que a
--      checagem precisa, sem expor a lista de bloqueios de ninguém
--      pra mais ninguém.
create policy "usuário vê a própria lista de bloqueios"
  on public.blocked_users for select
  to authenticated
  using (auth.uid() = blocker_id);

create policy "usuário vê se foi bloqueado (pra checagem de recomendação)"
  on public.blocked_users for select
  to authenticated
  using (auth.uid() = blocked_id);

create policy "usuário bloqueia em nome próprio"
  on public.blocked_users for insert
  to authenticated
  with check (auth.uid() = blocker_id);

create policy "usuário desbloqueia em nome próprio"
  on public.blocked_users for delete
  to authenticated
  using (auth.uid() = blocker_id);

-- =====================================================================
-- recommendations — o título em si, sempre parte de posts (nunca é
-- uma tabela "comment"/"message" genérica de propósito: cada linha é
-- SEMPRE "fulano recomendou X pra você", não uma conversa contínua).
-- =====================================================================
create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  media_type text not null check (media_type in ('movie', 'series')),
  media_id integer not null,
  message text check (char_length(message) <= 200),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender_id <> recipient_id)
);

create index recommendations_recipient_idx on public.recommendations (recipient_id, read_at);
create index recommendations_sender_idx on public.recommendations (sender_id);

alter table public.recommendations enable row level security;

create policy "remetente e destinatário veem a própria recomendação"
  on public.recommendations for select
  to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

-- Só pode recomendar pra quem SEGUE (não precisa ser mútuo — decisão
-- explícita), e não pode recomendar pra quem te bloqueou.
create policy "usuário recomenda em nome próprio, só pra quem segue, se não foi bloqueado"
  on public.recommendations for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.follows
      where follows.follower_id = auth.uid() and follows.following_id = recommendations.recipient_id
    )
    and not exists (
      select 1 from public.blocked_users
      where blocked_users.blocker_id = recommendations.recipient_id and blocked_users.blocked_id = auth.uid()
    )
  );

-- Só o destinatário marca como lida (única coisa que se "atualiza" aqui).
create policy "destinatário marca como lida"
  on public.recommendations for update
  to authenticated
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

-- Remetente ou destinatário podem apagar (destinatário "dispensa",
-- remetente pode desfazer um envio por engano).
create policy "remetente ou destinatário apaga"
  on public.recommendations for delete
  to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

notify pgrst, 'reload schema';
