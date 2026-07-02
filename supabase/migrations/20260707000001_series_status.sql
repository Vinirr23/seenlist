-- SeenList — series_status
--
-- TASK-005 (Página da Série, que esta tarefa proíbe alterar) só
-- registra episódios assistidos (watched_episodes) — não existe
-- nenhum "status" de série (assistindo/quero assistir/concluído).
-- Para a Biblioteca funcionar sem tocar na página da série, esta
-- tabela guarda só um status EXPLÍCITO, opcional, por série:
--   - se existir uma linha aqui, ela manda (inclusive 'removed',
--     usado por "remover da lista" sem apagar o histórico de
--     episódios assistidos);
--   - se não existir, o status é DERIVADO de watched_episodes na
--     camada de leitura da Biblioteca (lib/queries/library.ts):
--     tem episódio assistido e não completou = "watching",
--     completou todos = "completed", nenhum episódio = nem aparece.
-- "Quero assistir" para uma série sem nenhum episódio assistido só
-- existe se alguém escrever aqui — hoje não há tela que faça isso
-- (a página da série está fora do escopo desta tarefa), então essa
-- aba fica vazia pra séries até um próximo passo abrir esse caminho.

create table public.series_status (
  user_id uuid not null references auth.users (id) on delete cascade,
  series_id integer not null,
  status text not null check (status in ('want_to_watch', 'watching', 'completed', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, series_id)
);

create index series_status_user_idx on public.series_status (user_id);

alter table public.series_status enable row level security;

create policy "usuário vê apenas o próprio status de séries"
  on public.series_status for select
  using (auth.uid() = user_id);

create policy "usuário cria apenas o próprio status"
  on public.series_status for insert
  with check (auth.uid() = user_id);

create policy "usuário atualiza apenas o próprio status"
  on public.series_status for update
  using (auth.uid() = user_id);

create policy "usuário remove apenas o próprio status"
  on public.series_status for delete
  using (auth.uid() = user_id);
