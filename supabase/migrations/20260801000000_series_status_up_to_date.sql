-- TASK-033 — "up_to_date" ("Em dia") deixa de ser um flag calculado
-- na leitura (isCaughtUp) e passa a ser um status de verdade, gravado
-- pelo importador. Item 1 da tarefa: preservar esse conceito como
-- distinto de "watching", não mais uma variação dele.

alter table public.series_status drop constraint if exists series_status_status_check;

alter table public.series_status add constraint series_status_status_check
  check (status in ('want_to_watch', 'watching', 'completed', 'removed', 'paused', 'up_to_date'));

notify pgrst, 'reload schema';
