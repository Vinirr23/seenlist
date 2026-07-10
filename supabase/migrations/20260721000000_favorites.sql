-- TASK-028 (continuação) — tabela de favoritos.
--
-- O item 10 lista `favorites_visibility` (a configuração de quem
-- pode ver), mas não pede uma tabela pra guardar QUAL série/filme
-- foi favoritado — sem isso, "Séries favoritas"/"Filmes favoritos"
-- (item 6) não têm de onde vir. Adicionada aqui porque a própria
-- tarefa pede a seção funcionando, e não existe outro lugar no
-- schema atual que sirva pra isso (diferente de "Favoritos" como
-- feature ampla, que tarefas anteriores explicitamente deixaram de
-- fora — aqui é só o mínimo pra esta seção específica funcionar).

create table public.favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  media_type text not null check (media_type in ('movie', 'series')),
  media_id integer not null,
  created_at timestamptz not null default now(),
  primary key (user_id, media_type, media_id)
);

create index favorites_user_idx on public.favorites (user_id);

alter table public.favorites enable row level security;

-- Mesma regra de visibilidade de biblioteca/perfil: dono sempre vê o
-- próprio; outros veem conforme `favorites_visibility` do dono.
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

create policy "usuário gerencia apenas os próprios favoritos"
  on public.favorites for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

do $$
begin
  alter publication supabase_realtime add table public.favorites;
exception
  when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
