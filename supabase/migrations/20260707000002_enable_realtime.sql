-- SeenList — realtime para a Biblioteca
--
-- TASK-007 pede "atualização em tempo real sempre que o usuário
-- alterar um status". Isso exige que as tabelas estejam na
-- publicação `supabase_realtime` — sem isso, `postgres_changes` no
-- client não recebe nada, mesmo com RLS liberando a leitura.
-- watched_episodes já existia (TASK-005) mas nunca precisou disso
-- até agora.

alter publication supabase_realtime add table public.movie_status;
alter publication supabase_realtime add table public.series_status;
alter publication supabase_realtime add table public.watched_episodes;
