-- TASK-027D, itens 3/4 — "salvar apenas o resumo, nunca o GDPR em
-- si" + histórico interno de importações.

create table public.tvtime_import_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  imported_at timestamptz not null default now(),
  series_count integer not null,
  episodes_count integer not null,
  favorites_count integer not null,
  want_to_watch_count integer not null,
  completed_count integer not null,
  pending_review_count integer not null,
  confidence numeric(5, 2) not null,
  -- "Concluída" (primeira importação) vs "Atualização incremental"
  -- (reimportação do mesmo usuário) — ver item 4, exemplo do histórico.
  import_type text not null check (import_type in ('full', 'incremental')),
  created_at timestamptz not null default now()
);

create index tvtime_import_snapshots_user_idx on public.tvtime_import_snapshots (user_id, imported_at desc);

alter table public.tvtime_import_snapshots enable row level security;

create policy "usuário vê apenas o próprio histórico de importação"
  on public.tvtime_import_snapshots for select
  using (auth.uid() = user_id);

create policy "usuário registra apenas o próprio snapshot"
  on public.tvtime_import_snapshots for insert
  with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
