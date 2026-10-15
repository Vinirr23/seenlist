-- SeenList — progresso compartilhado no Realtime
--
-- A PEDIDO (2026-10-14, "quando o outro usuário marca um episódio, a
-- alteração é visível pros 2 atualmente?") — causa raiz: não era.
-- `list_watch_progress` nunca tinha sido adicionada à publicação
-- `supabase_realtime`, então o canal novo de `app/lists/[id].tsx`
-- (`postgres_changes` filtrado por `list_id`) não receberia NENHUM
-- evento, mesmo com RLS liberando a leitura — mesmo motivo já
-- documentado em `20261001000000_feed_reviews_realtime.sql` pra
-- `reviews`.
--
-- Aditivo, sem risco: só adiciona a tabela à publicação existente,
-- não cria tabela nem trigger novo, não muda nenhuma policy.

alter publication supabase_realtime add table public.list_watch_progress;
