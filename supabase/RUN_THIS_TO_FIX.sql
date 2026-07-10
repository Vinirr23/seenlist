-- SeenList — REPARO: cria tudo que falta, sem duplicar o que já existe
--
-- TASK-021: o console confirmou `PGRST205 — Could not find the table
-- 'public.movie_status' in the schema cache` (404) e o mesmo pra
-- `series_status`. Isso significa que essas tabelas nunca foram
-- criadas neste projeto Supabase — as migrations versionadas em
-- supabase/migrations/ nunca rodaram aqui (ou rodaram só em parte:
-- `watched_episodes` respondeu 400, não 404, sugerindo que ela existe
-- mas com algum outro problema — os resultados deste script vão
-- esclarecer isso também).
--
-- COMO USAR: copie este arquivo inteiro e rode no SQL Editor do
-- Supabase (https://supabase.com/dashboard/project/_/sql/new), de
-- uma vez só. Seguro rodar mais de uma vez — tudo usa
-- `if not exists` ou `drop ... if exists` antes de recriar, então
-- não duplica nada nem quebra se alguma parte já existir.
--
-- Depois de rodar, confira em /debug/database (TASK-021) que as 4
-- consultas (profiles, movie_status, series_status, watched_episodes)
-- voltam "OK".

create extension if not exists "uuid-ossp";

-- =================================================================
-- watched_episodes
-- =================================================================
create table if not exists public.watched_episodes (
  user_id uuid not null references auth.users (id) on delete cascade,
  series_id integer not null,
  season_number integer not null,
  episode_number integer not null,
  watched_at timestamptz not null default now(),
  primary key (user_id, series_id, season_number, episode_number)
);

create index if not exists watched_episodes_user_series_idx
  on public.watched_episodes (user_id, series_id);

alter table public.watched_episodes enable row level security;

drop policy if exists "usuário vê apenas os próprios episódios assistidos" on public.watched_episodes;
create policy "usuário vê apenas os próprios episódios assistidos"
  on public.watched_episodes for select
  using (auth.uid() = user_id);

drop policy if exists "usuário marca apenas em nome próprio" on public.watched_episodes;
create policy "usuário marca apenas em nome próprio"
  on public.watched_episodes for insert
  with check (auth.uid() = user_id);

drop policy if exists "usuário desmarca apenas em nome próprio" on public.watched_episodes;
create policy "usuário desmarca apenas em nome próprio"
  on public.watched_episodes for delete
  using (auth.uid() = user_id);

-- =================================================================
-- movie_status
-- =================================================================
create table if not exists public.movie_status (
  user_id uuid not null references auth.users (id) on delete cascade,
  movie_id integer not null,
  status text not null check (status in ('watched', 'want_to_watch', 'watching')),
  updated_at timestamptz not null default now(),
  primary key (user_id, movie_id)
);

-- Coluna adicionada numa migration posterior — se a tabela acima já
-- existia sem ela, isso completa o schema.
alter table public.movie_status add column if not exists created_at timestamptz not null default now();

create index if not exists movie_status_user_idx on public.movie_status (user_id);

alter table public.movie_status enable row level security;

drop policy if exists "usuário vê apenas o próprio status de filmes" on public.movie_status;
create policy "usuário vê apenas o próprio status de filmes"
  on public.movie_status for select
  using (auth.uid() = user_id);

drop policy if exists "usuário cria apenas o próprio status" on public.movie_status;
create policy "usuário cria apenas o próprio status"
  on public.movie_status for insert
  with check (auth.uid() = user_id);

drop policy if exists "usuário atualiza apenas o próprio status" on public.movie_status;
create policy "usuário atualiza apenas o próprio status"
  on public.movie_status for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "usuário remove apenas o próprio status" on public.movie_status;
create policy "usuário remove apenas o próprio status"
  on public.movie_status for delete
  using (auth.uid() = user_id);

-- =================================================================
-- series_status
-- =================================================================
create table if not exists public.series_status (
  user_id uuid not null references auth.users (id) on delete cascade,
  series_id integer not null,
  status text not null check (status in ('want_to_watch', 'watching', 'completed', 'removed', 'paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, series_id)
);

create index if not exists series_status_user_idx on public.series_status (user_id);

alter table public.series_status enable row level security;

drop policy if exists "usuário vê apenas o próprio status de séries" on public.series_status;
create policy "usuário vê apenas o próprio status de séries"
  on public.series_status for select
  using (auth.uid() = user_id);

drop policy if exists "usuário cria apenas o próprio status" on public.series_status;
create policy "usuário cria apenas o próprio status"
  on public.series_status for insert
  with check (auth.uid() = user_id);

drop policy if exists "usuário atualiza apenas o próprio status" on public.series_status;
create policy "usuário atualiza apenas o próprio status"
  on public.series_status for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "usuário remove apenas o próprio status" on public.series_status;
create policy "usuário remove apenas o próprio status"
  on public.series_status for delete
  using (auth.uid() = user_id);

-- =================================================================
-- Realtime — necessário pra Biblioteca/Perfil atualizarem sozinhos
-- =================================================================
do $$
begin
  alter publication supabase_realtime add table public.movie_status;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.series_status;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.watched_episodes;
exception
  when duplicate_object then null;
end $$;

-- =================================================================
-- Status "paused" (Pausada) — se a tabela já existia com o check
-- antigo (sem "paused"), esta parte corrige mesmo sem recriar nada.
-- =================================================================
alter table public.series_status drop constraint if exists series_status_status_check;
alter table public.series_status add constraint series_status_status_check
  check (status in ('want_to_watch', 'watching', 'completed', 'removed', 'paused'));

-- =================================================================
-- Recarregar o cache de schema do PostgREST
-- =================================================================
-- Depois de criar tabela via SQL Editor, o PostgREST às vezes
-- continua servindo um schema em cache desatualizado — e devolve
-- PGRST205 "table not found in schema cache" mesmo a tabela já
-- existindo de verdade no Postgres. Isso força o reload imediato.
-- Se você já rodou este script antes e series_status/movie_status
-- ainda derem esse erro específico, rode só este NOTIFY de novo.
notify pgrst, 'reload schema';

-- =================================================================
-- TASK-028 — Perfil Social: profiles, follows, username automático,
-- e leitura de biblioteca pública. Idempotente como o resto deste
-- arquivo.
-- =================================================================
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  bio text,
  banner_url text,
  country text,
  profile_visibility text not null default 'public' check (profile_visibility in ('public', 'followers', 'private')),
  favorites_visibility text not null default 'public' check (favorites_visibility in ('public', 'followers', 'private')),
  library_visibility text not null default 'public' check (library_visibility in ('public', 'followers', 'private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_username_lower_idx on public.profiles (lower(username));

alter table public.profiles enable row level security;

drop policy if exists "leitura de perfil respeita visibilidade" on public.profiles;
create policy "leitura de perfil respeita visibilidade"
  on public.profiles for select
  using (
    profile_visibility = 'public'
    or user_id = auth.uid()
    or (
      profile_visibility = 'followers'
      and exists (select 1 from public.follows where follower_id = auth.uid() and following_id = profiles.user_id)
    )
  );

drop policy if exists "usuário cria apenas o próprio perfil" on public.profiles;
create policy "usuário cria apenas o próprio perfil"
  on public.profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "usuário atualiza apenas o próprio perfil" on public.profiles;
create policy "usuário atualiza apenas o próprio perfil"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  following_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id)
);

do $$
begin
  alter table public.follows add constraint follows_no_self_follow check (follower_id <> following_id);
exception
  when duplicate_object then null;
end $$;

create index if not exists follows_follower_idx on public.follows (follower_id);
create index if not exists follows_following_idx on public.follows (following_id);

alter table public.follows enable row level security;

drop policy if exists "follows são públicos pra leitura" on public.follows;
create policy "follows são públicos pra leitura" on public.follows for select using (true);

drop policy if exists "usuário cria apenas o próprio follow" on public.follows;
create policy "usuário cria apenas o próprio follow"
  on public.follows for insert with check (auth.uid() = follower_id);

drop policy if exists "usuário remove apenas o próprio follow" on public.follows;
create policy "usuário remove apenas o próprio follow"
  on public.follows for delete using (auth.uid() = follower_id);

create or replace function public.generate_unique_username(base_email text)
returns text language plpgsql as $$
declare
  base_username text;
  candidate text;
  suffix int := 0;
begin
  base_username := lower(regexp_replace(split_part(coalesce(base_email, ''), '@', 1), '[^a-z0-9]', '', 'gi'));
  if base_username = '' then base_username := 'user'; end if;
  candidate := base_username;
  while exists (select 1 from public.profiles where username = candidate) loop
    suffix := suffix + 1;
    candidate := base_username || '_' || suffix;
  end loop;
  return candidate;
end;
$$;

create or replace function public.handle_new_user_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, username)
  values (new.id, public.generate_unique_username(new.email))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();

insert into public.profiles (user_id, username)
select id, public.generate_unique_username(email)
from auth.users
where id not in (select user_id from public.profiles)
on conflict (user_id) do nothing;

do $$ begin alter publication supabase_realtime add table public.profiles; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.follows; exception when duplicate_object then null; end $$;

drop policy if exists "usuário vê apenas o próprio status de séries" on public.series_status;
drop policy if exists "leitura de status de série respeita visibilidade" on public.series_status;
create policy "leitura de status de série respeita visibilidade"
  on public.series_status for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.profiles p
      where p.user_id = series_status.user_id
        and (
          p.library_visibility = 'public'
          or (p.library_visibility = 'followers' and exists (
            select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = p.user_id
          ))
        )
    )
  );

drop policy if exists "usuário vê apenas o próprio status de filmes" on public.movie_status;
drop policy if exists "leitura de status de filme respeita visibilidade" on public.movie_status;
create policy "leitura de status de filme respeita visibilidade"
  on public.movie_status for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.profiles p
      where p.user_id = movie_status.user_id
        and (
          p.library_visibility = 'public'
          or (p.library_visibility = 'followers' and exists (
            select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = p.user_id
          ))
        )
    )
  );

drop policy if exists "usuário vê apenas os próprios episódios assistidos" on public.watched_episodes;
drop policy if exists "leitura de episódios respeita visibilidade da biblioteca" on public.watched_episodes;
create policy "leitura de episódios respeita visibilidade da biblioteca"
  on public.watched_episodes for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.profiles p
      where p.user_id = watched_episodes.user_id
        and (
          p.library_visibility = 'public'
          or (p.library_visibility = 'followers' and exists (
            select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = p.user_id
          ))
        )
    )
  );

notify pgrst, 'reload schema';

-- =================================================================
-- Conferência final — rode isto separadamente depois, se quiser
-- confirmar sem precisar abrir o Table Editor:
--
-- select table_name from information_schema.tables
-- where table_schema = 'public'
-- order by table_name;
--
-- select * from public.movie_status limit 5;
-- select * from public.series_status limit 5;
-- select * from public.watched_episodes limit 5;
-- select * from public.profiles limit 5;
-- select * from public.follows limit 5;
-- =================================================================
