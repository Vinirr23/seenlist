-- SeenList — movie_status
--
-- Segunda tabela desde o reset do TASK-001 (a primeira foi
-- watched_episodes, no TASK-005). TASK-006 autoriza Supabase
-- explicitamente ("Usar Supabase apenas para dados do usuário"),
-- então esta tabela guarda só o status do usuário sobre um filme —
-- nada de dados de catálogo (isso continua vindo do TMDB, sem cache
-- local, fora do escopo pedido).

create table public.movie_status (
  user_id uuid not null references auth.users (id) on delete cascade,
  movie_id integer not null,
  status text not null check (status in ('watched', 'want_to_watch', 'watching')),
  updated_at timestamptz not null default now(),
  primary key (user_id, movie_id)
);

create index movie_status_user_idx on public.movie_status (user_id);

alter table public.movie_status enable row level security;

create policy "usuário vê apenas o próprio status de filmes"
  on public.movie_status for select
  using (auth.uid() = user_id);

create policy "usuário cria apenas o próprio status"
  on public.movie_status for insert
  with check (auth.uid() = user_id);

create policy "usuário atualiza apenas o próprio status"
  on public.movie_status for update
  using (auth.uid() = user_id);

create policy "usuário remove apenas o próprio status"
  on public.movie_status for delete
  using (auth.uid() = user_id);
