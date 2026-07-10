-- TASK-028 — Perfil Social: estrutura de banco.
--
-- Duas tabelas novas (profiles, follows) + expansão das policies de
-- LEITURA de movie_status/series_status/watched_episodes, pra que
-- "biblioteca pública" (item 6) funcione de verdade. Em todo lugar
-- que RLS é reescrita, a condição `auth.uid() = user_id` (acesso do
-- dono) é preservada literalmente — só adiciona outras formas de
-- passar no `using`, nunca remove a que já existia.

-- =================================================================
-- profiles — username, bio, banner, país, visibilidade
-- =================================================================
create table public.profiles (
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

create unique index profiles_username_lower_idx on public.profiles (lower(username));

-- =================================================================
-- follows — relacionamento seguidor/seguindo
--
-- CORREÇÃO: esta tabela precisa existir ANTES das policies de
-- `profiles` serem criadas — a policy de leitura de `profiles`
-- referencia `public.follows` num EXISTS, e `CREATE POLICY` resolve
-- essa referência imediatamente (não é uma resolução tardia, como
-- seria dentro do corpo de uma função). Na ordem original, essa
-- tabela só era criada DEPOIS das policies de `profiles` que já a
-- usavam — a criação da policy falhava com "relation public.follows
-- does not exist", e como a migration inteira roda numa transação
-- só, isso desfazia tudo que vinha antes no mesmo arquivo, incluindo
-- o `create table public.profiles`. Na prática, nada deste arquivo
-- nunca chegou a existir de fato no banco.
-- =================================================================
create table public.follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  following_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_no_self_follow check (follower_id <> following_id)
);

create index follows_follower_idx on public.follows (follower_id);
create index follows_following_idx on public.follows (following_id);

alter table public.follows enable row level security;

-- Contadores de seguidores/seguindo são públicos por natureza — todo mundo pode ler quem segue quem.
create policy "follows são públicos pra leitura"
  on public.follows for select
  using (true);

create policy "usuário cria apenas o próprio follow"
  on public.follows for insert
  with check (auth.uid() = follower_id);

create policy "usuário remove apenas o próprio follow"
  on public.follows for delete
  using (auth.uid() = follower_id);

-- =================================================================
-- Policies de profiles — agora que `follows` já existe.
-- =================================================================
alter table public.profiles enable row level security;

-- Leitura respeita a visibilidade escolhida — dono sempre pode ver o próprio.
create policy "leitura de perfil respeita visibilidade"
  on public.profiles for select
  using (
    profile_visibility = 'public'
    or user_id = auth.uid()
    or (
      profile_visibility = 'followers'
      and exists (
        select 1 from public.follows
        where follower_id = auth.uid() and following_id = profiles.user_id
      )
    )
  );

create policy "usuário cria apenas o próprio perfil"
  on public.profiles for insert
  with check (auth.uid() = user_id);

create policy "usuário atualiza apenas o próprio perfil"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =================================================================
-- Geração automática de username único
-- =================================================================
create or replace function public.generate_unique_username(base_email text)
returns text
language plpgsql
as $$
declare
  base_username text;
  candidate text;
  suffix int := 0;
begin
  base_username := lower(regexp_replace(split_part(coalesce(base_email, ''), '@', 1), '[^a-z0-9]', '', 'gi'));
  if base_username = '' then
    base_username := 'user';
  end if;

  candidate := base_username;
  while exists (select 1 from public.profiles where username = candidate) loop
    suffix := suffix + 1;
    candidate := base_username || '_' || suffix;
  end loop;

  return candidate;
end;
$$;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

-- Backfill — quem já tinha conta antes desta migration também ganha um username.
insert into public.profiles (user_id, username)
select id, public.generate_unique_username(email)
from auth.users
where id not in (select user_id from public.profiles)
on conflict (user_id) do nothing;

-- =================================================================
-- Realtime — segue o mesmo padrão das outras tabelas de usuário.
-- =================================================================
do $$
begin
  alter publication supabase_realtime add table public.profiles;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.follows;
exception
  when duplicate_object then null;
end $$;

-- =================================================================
-- Biblioteca pública (item 6): expande a LEITURA de series_status,
-- movie_status e watched_episodes pra respeitar library_visibility.
-- O dono continua podendo ler os próprios dados exatamente como
-- antes — isso só ADICIONA outros casos em que a leitura passa,
-- nunca remove o que já existia.
-- =================================================================
drop policy if exists "usuário vê apenas o próprio status de séries" on public.series_status;
create policy "leitura de status de série respeita visibilidade"
  on public.series_status for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.profiles p
      where p.user_id = series_status.user_id
        and (
          p.library_visibility = 'public'
          or (
            p.library_visibility = 'followers'
            and exists (
              select 1 from public.follows f
              where f.follower_id = auth.uid() and f.following_id = p.user_id
            )
          )
        )
    )
  );

drop policy if exists "usuário vê apenas o próprio status de filmes" on public.movie_status;
create policy "leitura de status de filme respeita visibilidade"
  on public.movie_status for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.profiles p
      where p.user_id = movie_status.user_id
        and (
          p.library_visibility = 'public'
          or (
            p.library_visibility = 'followers'
            and exists (
              select 1 from public.follows f
              where f.follower_id = auth.uid() and f.following_id = p.user_id
            )
          )
        )
    )
  );

drop policy if exists "usuário vê apenas os próprios episódios assistidos" on public.watched_episodes;
create policy "leitura de episódios respeita visibilidade da biblioteca"
  on public.watched_episodes for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.profiles p
      where p.user_id = watched_episodes.user_id
        and (
          p.library_visibility = 'public'
          or (
            p.library_visibility = 'followers'
            and exists (
              select 1 from public.follows f
              where f.follower_id = auth.uid() and f.following_id = p.user_id
            )
          )
        )
    )
  );

notify pgrst, 'reload schema';
