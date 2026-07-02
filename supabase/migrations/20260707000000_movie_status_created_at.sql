-- SeenList — movie_status.created_at
--
-- Aditivo, não destrutivo: só adiciona uma coluna com default, não
-- muda nada que TASK-006 (Página do Filme) já escreve. Necessário
-- pra Biblioteca conseguir ordenar por "Data adicionada" separado de
-- "Atualizados recentemente" (movie_status só tinha updated_at).

alter table public.movie_status
  add column created_at timestamptz not null default now();
