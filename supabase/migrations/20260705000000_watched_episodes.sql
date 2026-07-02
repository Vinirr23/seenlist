-- SeenList — watched_episodes
--
-- Primeira tabela criada desde o reset do TASK-001. Todas as tarefas
-- anteriores (002, 003, 004) tinham "não criar banco de dados" nas
-- restrições explícitas — esta (005) não tem essa frase, e pede
-- literalmente "Salvar no Supabase" ao marcar um episódio como
-- assistido. Entendi isso como autorização implícita para criar
-- somente o mínimo necessário pra essa funcionalidade — não recriei
-- o schema maior arquivado antes do TASK-001 (profiles, ratings,
-- comments etc. continuam fora, e continuam proibidos pelas
-- restrições desta própria tarefa: "não implementar avaliações",
-- "não implementar comentários", "não implementar curtidas").

create extension if not exists "uuid-ossp";

create table public.watched_episodes (
  user_id uuid not null references auth.users (id) on delete cascade,
  series_id integer not null,
  season_number integer not null,
  episode_number integer not null,
  watched_at timestamptz not null default now(),
  primary key (user_id, series_id, season_number, episode_number)
);

create index watched_episodes_user_series_idx
  on public.watched_episodes (user_id, series_id);

alter table public.watched_episodes enable row level security;

create policy "usuário vê apenas os próprios episódios assistidos"
  on public.watched_episodes for select
  using (auth.uid() = user_id);

create policy "usuário marca apenas em nome próprio"
  on public.watched_episodes for insert
  with check (auth.uid() = user_id);

create policy "usuário desmarca apenas em nome próprio"
  on public.watched_episodes for delete
  using (auth.uid() = user_id);
