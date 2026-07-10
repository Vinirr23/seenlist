-- TASK-027L — o novo pipeline (extensão "TV Time Out") traz o flag
-- `special` por EPISÓDIO (não só por temporada 0 como antes — 89
-- episódios reais do export de teste são especiais dentro de
-- temporadas normais). "Ignorar no cálculo de progresso, mas
-- preservar pra estatísticas futuras" — por isso não é um filtro na
-- hora de gravar, é uma coluna: o episódio especial é gravado do
-- mesmo jeito, só marcado, e toda consulta de PROGRESSO/BIBLIOTECA
-- passa a excluir is_special = true explicitamente.

alter table public.watched_episodes
  add column if not exists is_special boolean not null default false,
  add column if not exists rewatch_count integer not null default 0;

comment on column public.watched_episodes.is_special is
  'Vem do campo special do export da extensão TV Time Out — true pra episódios especiais (não só temporada 0, qualquer episódio marcado como especial pelo TV Time). Contagem de progresso/biblioteca sempre filtra is_special = false; guardado aqui só pra estatísticas futuras (TASK-027L), nunca influencia status/próximo episódio.';
comment on column public.watched_episodes.rewatch_count is
  'Vem do campo rewatch_count do export da extensão TV Time Out — quantas vezes o episódio foi reassistido, além da primeira. Estatística de consumo (mesmo espírito de total_watch_events em series_status), nunca usado pra decidir status ou progresso.';

create index if not exists watched_episodes_is_special_idx on public.watched_episodes (user_id, series_id, is_special);

-- Mesmo motivo, pro lado de filmes.
alter table public.movie_status
  add column if not exists watched_at timestamptz,
  add column if not exists rewatch_count integer not null default 0;

comment on column public.movie_status.watched_at is
  'Quando o filme foi assistido — vem do watched_at do export da extensão TV Time Out (TASK-027L). Null pra filmes marcados sem essa informação.';
comment on column public.movie_status.rewatch_count is
  'Mesmo conceito de watched_episodes.rewatch_count, aplicado ao filme inteiro — não decide status.';

notify pgrst, 'reload schema';
