-- Pré-geração do "destaque da semana" (Week Review), rodada 27
-- (2026-09-23) — resolve a latência real reportada na rodada 24
-- ("demora bastante", "precisa ser instantâneo"). Decisão do usuário
-- naquela rodada: pré-gerar com antecedência via job agendado, em vez
-- de calcular ao vivo toda vez que a tela real abre. Os dois
-- bloqueios (lógica de destaque, rodada 25; tela real de produção,
-- rodada 26) já estavam resolvidos — esta migration cria a tabela
-- onde a Edge Function `week-review-pregenerate` (job semanal) grava
-- o resultado pronto, pra tela real (`app/week-review.tsx`) só ler.
--
-- Uma linha por (usuário, semana) — chave primária composta evita
-- duplicata se o job rodar mais de uma vez pra mesma semana (ex.:
-- reprocessamento manual), e serve de UPSERT natural.
create table if not exists public.week_review_pregenerated (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start timestamptz not null,
  week_end timestamptz not null,
  media_type text not null check (media_type in ('series', 'movie')),
  media_id integer not null,
  season_number integer,
  rating numeric(3,1),
  activity_count integer not null,
  phrases jsonb not null,
  generated_at timestamptz not null default now(),
  primary key (user_id, week_start)
);

comment on table public.week_review_pregenerated is
  'Cache do destaque da semana + frases já geradas por IA, escrito pelo job semanal (Edge Function week-review-pregenerate). A tela real (app/week-review.tsx) lê daqui primeiro; se não achar linha pra semana atual, calcula ao vivo como fazia antes (fallback, não regressão).';

-- RLS: cada usuário só lê a própria linha (mesmo padrão de outras
-- tabelas do app). Escrita é só via Service Role (Edge Function),
-- então não precisa de policy de INSERT/UPDATE pra usuário comum.
alter table public.week_review_pregenerated enable row level security;

create policy "week_review_pregenerated_select_own"
  on public.week_review_pregenerated
  for select
  using (auth.uid() = user_id);

-- Índice pra achar rápido "todas as linhas de uma semana específica"
-- (útil pra observabilidade/depuração do job, ex.: "quantos usuários
-- foram processados na última rodada").
create index if not exists week_review_pregenerated_week_start_idx
  on public.week_review_pregenerated (week_start);
