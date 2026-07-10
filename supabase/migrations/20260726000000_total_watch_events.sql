-- TASK-027J — separa definitivamente "estado da biblioteca" (episódios
-- únicos, já existia via watched_episodes) de "histórico de consumo"
-- (total de visualizações, incluindo reassistidas — nunca existia em
-- lugar nenhum do schema até agora).
--
-- Nullable, sem valor padrão: séries que nunca passaram pelo
-- importador do TV Time (adicionadas manualmente no SeenList) não têm
-- esse número — para essas, as estatísticas caem de volta em episódios
-- únicos (só faz sentido, já que "reassistir" não é um conceito que
-- existe ainda fora da importação).

alter table public.series_status
  add column total_watch_events integer;

comment on column public.series_status.total_watch_events is
  'Total de visualizações reportado pelo TV Time (nb_episodes_seen bruto, incluindo reassistidas) — usado SÓ para estatísticas (episódios assistidos, horas assistidas). Nunca usado para decidir status ou progresso da biblioteca, que usam exclusivamente watched_episodes (episódios únicos). Null quando a série nunca foi importada do TV Time.';

notify pgrst, 'reload schema';
