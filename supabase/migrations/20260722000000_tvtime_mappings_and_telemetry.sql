-- TASK-027.5 — banco de equivalências TV Time → TMDB, e telemetria
-- do importador.
--
-- `tvtime_tmdb_mappings` é GLOBAL (não por usuário): uma vez que
-- "TV Time id X = TMDB id Y" foi confirmado (automaticamente por
-- score alto, ou manualmente por algum usuário), essa correspondência
-- vale pra qualquer pessoa que importe a mesma série depois — é
-- exatamente o "aprender continuamente" pedido. Índice único em
-- tvtime_id: uma série do TV Time sempre aponta pro mesmo TMDB id.

create table public.tvtime_tmdb_mappings (
  tvtime_id text primary key,
  tmdb_id integer not null,
  tvtime_name text not null,
  confidence text not null check (confidence in ('auto', 'manual')),
  created_at timestamptz not null default now()
);

create index tvtime_tmdb_mappings_tmdb_idx on public.tvtime_tmdb_mappings (tmdb_id);

alter table public.tvtime_tmdb_mappings enable row level security;

-- Tabela de conhecimento compartilhado: qualquer usuário autenticado
-- pode ler (precisa, pra aproveitar o cache) e gravar (confirmar uma
-- correspondência nova). Não é uma tabela de dados pessoais — não
-- tem user_id nenhum, só "TV Time X = TMDB Y", então não faz sentido
-- restringir por dono.
create policy "mapeamentos são legíveis por qualquer usuário autenticado"
  on public.tvtime_tmdb_mappings for select
  to authenticated
  using (true);

create policy "qualquer usuário autenticado pode contribuir com um mapeamento"
  on public.tvtime_tmdb_mappings for insert
  to authenticated
  with check (true);

-- Nunca permite update/delete por usuário comum — uma correspondência
-- confirmada não deveria ser sobrescrita por qualquer um; corrigir um
-- mapeamento errado é uma operação administrativa, não de usuário.

-- =================================================================
-- Telemetria do importador — anônima por design: sem texto livre do
-- usuário, sem e-mail, sem nome. Só números e títulos de séries (que
-- já são informação pública do TV Time/TMDB, não dado pessoal).
-- Serve pra medir e melhorar o algoritmo de matching ao longo do
-- tempo, e pra alimentar `tvtime_tmdb_mappings` quando uma escolha
-- manual é feita.
-- =================================================================
create table public.tvtime_import_events (
  id uuid primary key default gen_random_uuid(),
  -- Referencia o usuário só pra permitir "um usuário não spamma
  -- telemetria" via RLS — nunca é exposto em nenhuma tela, nunca é
  -- lido de volta pelo cliente (só insert).
  user_id uuid not null references auth.users (id) on delete cascade,
  total_shows integer not null,
  auto_matched_shows integer not null,
  manually_resolved_shows integer not null,
  not_found_shows integer not null,
  imported_episodes integer not null,
  elapsed_seconds integer not null,
  -- Nomes das séries que geraram ambiguidade — não é dado pessoal,
  -- é o nome público da série (vindo do TV Time). Usado pra ver
  -- quais títulos o algoritmo mais erra.
  ambiguous_titles text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.tvtime_import_events enable row level security;

-- Só insert — ninguém lê de volta pelo cliente (nem o próprio
-- usuário); análise é feita depois via SQL direto/dashboard, não
-- pelo app. É isso que torna razoável chamar de "anônimo" na
-- prática: o dado existe, mas não alimenta nenhuma tela nem
-- funcionalidade voltada a esse usuário específico.
create policy "usuário autenticado pode registrar um evento de importação"
  on public.tvtime_import_events for insert
  to authenticated
  with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
