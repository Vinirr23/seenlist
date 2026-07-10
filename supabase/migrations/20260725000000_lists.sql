-- TASK-029 — "Minhas listas" não existia antes como funcionalidade
-- nenhuma. Criado aqui só o mínimo que a tarefa descreve: nome da
-- lista e quem é dono. Não inclui uma tabela de "itens da lista"
-- (série/filme dentro de uma lista específica) — isso não foi
-- descrito nesta tarefa (só "mostrar as listas" e "criar nova
-- lista"), e inventar esse modelo de dados sem instrução seria
-- decisão de escopo que não deveria ser tomada escondida aqui.

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lists_user_idx on public.lists (user_id, created_at desc);

alter table public.lists enable row level security;

create policy "usuário vê apenas as próprias listas"
  on public.lists for select
  using (auth.uid() = user_id);

create policy "usuário cria apenas a própria lista"
  on public.lists for insert
  with check (auth.uid() = user_id);

create policy "usuário atualiza apenas a própria lista"
  on public.lists for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "usuário remove apenas a própria lista"
  on public.lists for delete
  using (auth.uid() = user_id);

notify pgrst, 'reload schema';
