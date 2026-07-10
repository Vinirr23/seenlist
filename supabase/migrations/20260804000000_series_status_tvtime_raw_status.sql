alter table public.series_status
  add column if not exists tvtime_status text;

comment on column public.series_status.tvtime_status is
  'Status BRUTO do arquivo do TV Time (continuing/up_to_date/stopped/watch_later/not_started_yet), preservado tal como veio do CSV. Nunca usado para decidir categoria/progresso -- isso continua sendo status (a coluna derivada). Nulo para linhas gravadas antes desta migration ou por qualquer outro caminho que nao passe pelo importador do TV Time.';

notify pgrst, 'reload schema';
