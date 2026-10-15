-- FEATURE: progresso compartilhado independente (2026-10-14, a pedido
-- do usuário, mockup aprovado — "Progresso compartilhado" —
-- https://claude.ai/artifact/2EoarKtBiGa5gCgDxGLxCq).
--
-- Problema que resolve: hoje o histórico de episódios assistidos
-- (`watched_episodes`) é SEMPRE individual, por `user_id`. Numa lista
-- compartilhada, isso obriga quem já viu a série (ex.: 100%) a
-- desmarcar episódios pra "acompanhar" quem está vendo por 1ª vez — o
-- usuário rejeitou essa ideia explicitamente.
--
-- Decisão do usuário (não um sistema de episódios paralelo): guarda só
-- UMA posição atual (temporada + episódio) por LISTA + TÍTULO, não por
-- pessoa — os dois participantes compartilham a mesma linha. Isso é
-- deliberadamente independente de `watched_episodes`: marcar aqui
-- NUNCA escreve lá, e vice-versa (ver comentário grande em
-- `lib/listWatchProgress.ts`, mobile).
--
-- Regra de permissão: reaproveita EXATAMENTE o mesmo predicado já
-- usado pelas políticas de `list_items` (dono OU co-dono com convite
-- ACEITO — ver `20261006000001_lists_co_owner.sql`). Convite ainda
-- pendente não tem direito sobre progresso, mesma lógica de itens.

-- =====================================================================
-- 1. Tabela
-- =====================================================================
create table if not exists public.list_watch_progress (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists (id) on delete cascade,
  media_type text not null check (media_type in ('movie', 'series')),
  media_id bigint not null,
  season_number integer,
  episode_number integer,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (list_id, media_type, media_id)
);

comment on table public.list_watch_progress is
  'Progresso de "assistir juntos", UMA linha por lista+título — compartilhada pelos dois participantes, independente do histórico individual de cada um (public.watched_episodes). season_number/episode_number = posição atual combinada; NULL nos dois = ainda não começaram a acompanhar juntos.';
comment on column public.list_watch_progress.status is
  '''in_progress'' = ainda assistindo juntos. ''completed'' = terminaram a série juntos (vira "Concluída juntos" na UI).';

create index if not exists list_watch_progress_list_id_idx on public.list_watch_progress (list_id);

-- =====================================================================
-- 2. RLS — mesmo predicado de public.list_items (dono OU co-dono
--    ACEITO; convite pendente não tem direito sobre progresso).
-- =====================================================================
alter table public.list_watch_progress enable row level security;

drop policy if exists "dono ou co-dono vê o progresso compartilhado" on public.list_watch_progress;
create policy "dono ou co-dono vê o progresso compartilhado"
  on public.list_watch_progress for select
  using (exists (
    select 1 from public.lists l
    where l.id = list_watch_progress.list_id
      and (l.user_id = auth.uid() or (l.co_owner_id = auth.uid() and l.co_owner_status = 'accepted'))
  ));

drop policy if exists "dono ou co-dono cria o progresso compartilhado" on public.list_watch_progress;
create policy "dono ou co-dono cria o progresso compartilhado"
  on public.list_watch_progress for insert
  with check (exists (
    select 1 from public.lists l
    where l.id = list_watch_progress.list_id
      and (l.user_id = auth.uid() or (l.co_owner_id = auth.uid() and l.co_owner_status = 'accepted'))
  ));

drop policy if exists "dono ou co-dono atualiza o progresso compartilhado" on public.list_watch_progress;
create policy "dono ou co-dono atualiza o progresso compartilhado"
  on public.list_watch_progress for update
  using (exists (
    select 1 from public.lists l
    where l.id = list_watch_progress.list_id
      and (l.user_id = auth.uid() or (l.co_owner_id = auth.uid() and l.co_owner_status = 'accepted'))
  ))
  with check (exists (
    select 1 from public.lists l
    where l.id = list_watch_progress.list_id
      and (l.user_id = auth.uid() or (l.co_owner_id = auth.uid() and l.co_owner_status = 'accepted'))
  ));

-- Sem policy de DELETE em v1 — nenhuma UI chama delete ainda (resetar
-- progresso não foi pedido). Reduzir escopo deliberado, não esquecimento.

notify pgrst, 'reload schema';
