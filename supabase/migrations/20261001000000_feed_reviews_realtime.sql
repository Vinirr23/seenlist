-- SeenList — reviews no Realtime do Feed
--
-- A PEDIDO (2026-10-01, "Feed vivo" — indicador "↑ Novidades" quando
-- há atividade nova de quem não é o próprio usuário) — `movie_status`
-- e `series_status` já estavam na publicação `supabase_realtime` desde
-- a TASK-007 (20260707000002_enable_realtime.sql); só faltava
-- `reviews`. Sem isso, o canal `realtime-feed-new-activity` do Feed
-- (apps/mobile/app/(tabs)/feed.tsx) nunca receberia evento nenhum de
-- review nova/editada — `postgres_changes` não entrega nada pra uma
-- tabela fora da publicação, mesmo com RLS liberando a leitura.
--
-- Aditivo, sem risco: só adiciona a tabela à publicação existente,
-- não cria tabela nem trigger novo, não muda nenhuma policy.

alter publication supabase_realtime add table public.reviews;
