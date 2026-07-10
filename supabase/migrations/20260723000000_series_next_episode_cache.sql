-- TASK-027C, item 6 — "salvar automaticamente próximo episódio e
-- próxima temporada; evitar recalcular sempre que a Home abrir".
--
-- Colunas nullable, sem valor padrão diferente de null: séries que já
-- existiam antes desta migration simplesmente ficam com null aqui até
-- a próxima vez que algo recalcular o progresso delas (marcar
-- episódio, importar de novo) — não é um dado obrigatório, é um
-- cache opcional de algo que já é derivável de watched_episodes.

alter table public.series_status
  add column next_season_number integer,
  add column next_episode_number integer;

comment on column public.series_status.next_season_number is
  'Cache do próximo episódio a assistir (temporada) — calculado no import do TV Time ou ao marcar episódio, evita recalcular na Home. Null = não calculado ainda ou série concluída.';
comment on column public.series_status.next_episode_number is
  'Cache do próximo episódio a assistir (número) — ver next_season_number.';

notify pgrst, 'reload schema';
