-- BACKFILL (documentação, sem efeito funcional) — quatro índices da
-- tabela `notifications` existem de verdade em produção, mas nenhum
-- tinha migration correspondente salva no repositório (mesmo padrão
-- já registrado antes neste projeto, ver comentário em
-- `20260820000000_recommendation_notifications.sql`: colunas/índices
-- aplicados direto pelo SQL Editor em algum momento, sem passar por
-- uma migration versionada).
--
-- Conferido direto no banco (`select indexname, indexdef from
-- pg_indexes where tablename = 'notifications'`) antes de escrever
-- isto — não assumido, checado. Todos os `create index/unique index
-- if not exists` abaixo são idempotentes: rodar esta migration num
-- banco onde eles JÁ existem (o caso de produção hoje) não muda nada;
-- rodar num banco NOVO (do zero) finalmente cria o que faltava,
-- fechando o risco de um `supabase db push` num ambiente novo ficar
-- incompleto.

-- Dedup de notificação de episódio novo / estreia de temporada — sem
-- isso, o `upsert(...).onConflict(...)` de `check-new-releases`
-- falha com 42P10 ("no unique constraint matching"), mesmo erro já
-- visto e corrigido antes nesse projeto (ver `20260829000000`, que
-- criou uma versão anterior disso com dois índices PARCIAIS — já
-- substituídos por este índice único normal, os parciais não existem
-- mais em produção).
create unique index if not exists notifications_dedup_idx
  on public.notifications (user_id, target_media_id, target_season_number, target_episode_number);

-- Agrupamento de curtida não lida (comentário/avaliação) — dá suporte
-- ao "N pessoas curtiram seu comentário" (`group_count` em
-- `send-push-notifications/index.ts`, função `buildMessage`).
create unique index if not exists notifications_group_unread_idx
  on public.notifications (user_id, type, target_id)
  where read_at is null and type = any (array['comment_like', 'review_like']);

-- Busca rápida do que ainda não foi enviado — é exatamente a consulta
-- que `claim_pending_notifications` (`20260902000000`) faz toda vez
-- que roda (a cada 2 minutos).
create index if not exists notifications_pending_push_idx
  on public.notifications (created_at)
  where pushed_at is null;

-- Busca por episódio/temporada de uma série específica.
create index if not exists notifications_target_idx
  on public.notifications (target_media_type, target_media_id, target_season_number, target_episode_number)
  where type = any (array['episode_new', 'season_premiere']);
