-- Adiciona "paused" ("Pausada") aos status válidos de series_status.
-- Pedido explicitamente nesta tarefa — diferente de decisões
-- anteriores, aqui o usuário autorizou uma mudança de schema.

alter table public.series_status drop constraint if exists series_status_status_check;

alter table public.series_status add constraint series_status_status_check
  check (status in ('want_to_watch', 'watching', 'completed', 'removed', 'paused'));

notify pgrst, 'reload schema';
