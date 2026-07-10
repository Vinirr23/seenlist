-- =====================================================================
-- MIGRATION CONSOLIDADA — Infraestrutura completa do Perfil Social
-- =====================================================================
-- Investigação confirmou: o banco real não tem profiles/follows/
-- favorites/lists — só existiam nos arquivos de migration anteriores
-- (20260720000000, 20260721000000, 20260725000000, 20260727000000),
-- que aparentemente nunca foram aplicados com sucesso. Este arquivo
-- consolida tudo aquilo NUM SÓ script, idempotente (seguro rodar mais
-- de uma vez, inclusive parcialmente aplicado), e adiciona o que
-- ainda faltava (`list_items`, bucket de avatar).
--
-- Toda coluna/tabela/policy aqui foi conferida contra o código
-- TypeScript atual (lib/queries/my-profile.ts, public-profile.ts,
-- current-user.ts, avatar-upload.ts, lib/actions/account.ts,
-- lib/queries/lists.ts, lib/queries/favorites.ts,
-- lib/queries/library-state.ts, public-library.ts) — não precisa
-- alterar nenhum componente React depois de rodar isso.
-- =====================================================================

create extension if not exists pgcrypto;

-- =====================================================================
-- 1. PROFILES
-- =====================================================================
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  display_name text,
  avatar_url text,
  bio text,
  banner_url text,
  country text,
  language text not null default 'pt-BR',
  profile_visibility text not null default 'public' check (profile_visibility in ('public', 'followers', 'private')),
  favorites_visibility text not null default 'public' check (favorites_visibility in ('public', 'followers', 'private')),
  library_visibility text not null default 'public' check (library_visibility in ('public', 'followers', 'private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Idempotência pra quem já tinha a tabela criada parcialmente (sem os campos mais novos).
alter table public.profiles add column if not exists id uuid not null default gen_random_uuid() unique;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists language text not null default 'pt-BR';

create unique index if not exists profiles_username_lower_idx on public.profiles (lower(username));

comment on column public.profiles.id is 'Identificador opaco adicional, além de user_id (chave primária/estrangeira natural) — pra funcionalidades sociais futuras que prefiram não expor user_id diretamente.';
comment on column public.profiles.display_name is 'Nome de exibição público — sincronizado de auth.users.user_metadata.full_name (lib/actions/account.ts). É a fonte que outros usuários conseguem ler; user_metadata nunca é público via RLS.';
comment on column public.profiles.avatar_url is 'URL do avatar público — sincronizado de auth.users.user_metadata.avatar_url (lib/queries/avatar-upload.ts). Mesmo motivo do display_name.';

-- =====================================================================
-- 2. FOLLOWS (precisa existir ANTES das policies de profiles, que a referenciam)
-- =====================================================================
create table if not exists public.follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  following_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_no_self_follow check (follower_id <> following_id)
);

create index if not exists follows_follower_idx on public.follows (follower_id);
create index if not exists follows_following_idx on public.follows (following_id);

alter table public.follows enable row level security;

drop policy if exists "follows são públicos pra leitura" on public.follows;
create policy "follows são públicos pra leitura"
  on public.follows for select
  using (true);

drop policy if exists "usuário cria apenas o próprio follow" on public.follows;
create policy "usuário cria apenas o próprio follow"
  on public.follows for insert
  with check (auth.uid() = follower_id);

drop policy if exists "usuário remove apenas o próprio follow" on public.follows;
create policy "usuário remove apenas o próprio follow"
  on public.follows for delete
  using (auth.uid() = follower_id);

-- =====================================================================
-- Policies de profiles (agora que follows existe)
-- =====================================================================
alter table public.profiles enable row level security;

drop policy if exists "leitura de perfil respeita visibilidade" on public.profiles;
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

drop policy if exists "usuário cria apenas o próprio perfil" on public.profiles;
create policy "usuário cria apenas o próprio perfil"
  on public.profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "usuário atualiza apenas o próprio perfil" on public.profiles;
create policy "usuário atualiza apenas o próprio perfil"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =====================================================================
-- 3. FAVORITES
-- =====================================================================
create table if not exists public.favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  media_type text not null check (media_type in ('movie', 'series')),
  media_id integer not null,
  created_at timestamptz not null default now(),
  primary key (user_id, media_type, media_id)
);

create index if not exists favorites_user_idx on public.favorites (user_id);

alter table public.favorites enable row level security;

drop policy if exists "leitura de favoritos respeita visibilidade" on public.favorites;
create policy "leitura de favoritos respeita visibilidade"
  on public.favorites for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.profiles p
      where p.user_id = favorites.user_id
        and (
          p.favorites_visibility = 'public'
          or (
            p.favorites_visibility = 'followers'
            and exists (
              select 1 from public.follows f
              where f.follower_id = auth.uid() and f.following_id = p.user_id
            )
          )
        )
    )
  );

drop policy if exists "usuário gerencia apenas os próprios favoritos" on public.favorites;
create policy "usuário gerencia apenas os próprios favoritos"
  on public.favorites for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =====================================================================
-- 4. LISTS
-- =====================================================================
create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lists_user_idx on public.lists (user_id, created_at desc);

alter table public.lists enable row level security;

drop policy if exists "usuário vê apenas as próprias listas" on public.lists;
create policy "usuário vê apenas as próprias listas"
  on public.lists for select
  using (auth.uid() = user_id);

drop policy if exists "usuário cria apenas a própria lista" on public.lists;
create policy "usuário cria apenas a própria lista"
  on public.lists for insert
  with check (auth.uid() = user_id);

drop policy if exists "usuário atualiza apenas a própria lista" on public.lists;
create policy "usuário atualiza apenas a própria lista"
  on public.lists for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "usuário remove apenas a própria lista" on public.lists;
create policy "usuário remove apenas a própria lista"
  on public.lists for delete
  using (auth.uid() = user_id);

-- =====================================================================
-- 5. LIST_ITEMS — não existia em nenhuma tarefa anterior. Adicionado
-- agora porque "lists" sem conteúdo não sustenta a feature. Sem
-- conceito de lista pública ainda (a tabela `lists` não tem coluna de
-- visibilidade) — por isso list_items é 100% privado ao dono. Quando
-- "lista pública" existir de verdade, esta policy de select precisa
-- ser revisada junto.
-- =====================================================================
create table if not exists public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists (id) on delete cascade,
  media_type text not null check (media_type in ('movie', 'series')),
  media_id integer not null,
  added_at timestamptz not null default now(),
  unique (list_id, media_type, media_id)
);

create index if not exists list_items_list_idx on public.list_items (list_id);

alter table public.list_items enable row level security;

drop policy if exists "usuário vê itens apenas das próprias listas" on public.list_items;
create policy "usuário vê itens apenas das próprias listas"
  on public.list_items for select
  using (exists (select 1 from public.lists l where l.id = list_items.list_id and l.user_id = auth.uid()));

drop policy if exists "usuário adiciona itens apenas nas próprias listas" on public.list_items;
create policy "usuário adiciona itens apenas nas próprias listas"
  on public.list_items for insert
  with check (exists (select 1 from public.lists l where l.id = list_items.list_id and l.user_id = auth.uid()));

drop policy if exists "usuário remove itens apenas das próprias listas" on public.list_items;
create policy "usuário remove itens apenas das próprias listas"
  on public.list_items for delete
  using (exists (select 1 from public.lists l where l.id = list_items.list_id and l.user_id = auth.uid()));

-- =====================================================================
-- 6. Funções auxiliares + trigger de criação automática de perfil
-- =====================================================================
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
  insert into public.profiles (user_id, username, display_name, avatar_url)
  values (
    new.id,
    public.generate_unique_username(new.email),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();

-- Backfill — quem já tem conta, mas nunca ganhou uma linha em profiles.
insert into public.profiles (user_id, username, display_name, avatar_url)
select
  u.id,
  public.generate_unique_username(u.email),
  coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
  u.raw_user_meta_data ->> 'avatar_url'
from auth.users u
where u.id not in (select user_id from public.profiles)
on conflict (user_id) do nothing;

-- Backfill adicional — quem já tinha profile mas ainda não tinha display_name/avatar_url preenchidos.
update public.profiles p
set
  display_name = coalesce(p.display_name, u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
  avatar_url = coalesce(p.avatar_url, u.raw_user_meta_data ->> 'avatar_url')
from auth.users u
where u.id = p.user_id
  and (p.display_name is null or p.avatar_url is null);

-- =====================================================================
-- 7. Realtime
-- =====================================================================
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

do $$
begin
  alter publication supabase_realtime add table public.favorites;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.lists;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.list_items;
exception
  when duplicate_object then null;
end $$;

-- =====================================================================
-- 8. Biblioteca pública — expande a LEITURA de series_status,
-- movie_status e watched_episodes pra respeitar library_visibility.
-- O dono continua podendo ler os próprios dados exatamente como
-- antes — isso só ADICIONA outros casos em que a leitura passa.
-- =====================================================================
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

-- =====================================================================
-- 9. Storage — bucket de avatar. `storage.buckets` é uma tabela comum
-- no Postgres do Supabase, então dá pra garantir que o bucket existe
-- via SQL (não precisa criar manualmente no painel).
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatar é público pra leitura" on storage.objects;
create policy "avatar é público pra leitura"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "usuário sobe avatar apenas na própria pasta" on storage.objects;
create policy "usuário sobe avatar apenas na própria pasta"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "usuário atualiza avatar apenas na própria pasta" on storage.objects;
create policy "usuário atualiza avatar apenas na própria pasta"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "usuário remove avatar apenas na própria pasta" on storage.objects;
create policy "usuário remove avatar apenas na própria pasta"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

notify pgrst, 'reload schema';
