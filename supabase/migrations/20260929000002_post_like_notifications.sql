-- =====================================================================
-- BUG REPORTADO (2026-09-29) — "curti o post que fiz no feed com
-- outra conta, mas não recebi notificação".
--
-- CAUSA RAIZ (achada investigando, não assumida): `notify_like()`
-- (criada em 20260915010000_notification_triggers_missing_types.sql)
-- só trata `target_type = 'comment'` e `'review'`. Qualquer outro
-- valor — inclusive `'post'`, usado pelo Feed desde TASK-059/066 —
-- cai no `else` e retorna sem inserir nada. O comentário original só
-- menciona `'list'` como ignorado de propósito; `'post'` nunca foi um
-- caso pensado, ficou faltando o último elo da feature (nem
-- `notifications_type_check` tem `'post_like'`, nem o front-end web/
-- mobile sabe renderizar esse tipo — checado em toda a base, zero
-- ocorrências de 'post_like'/'postLike' antes desta migration).
--
-- Esta migration cobre a parte de SCHEMA (constraints, coluna de
-- preferência, índice de agrupamento). A função `notify_like()` em si
-- é alterada numa migration separada
-- (20260929000003_post_like_notify_trigger.sql), depois de confirmar
-- a definição REAL em produção — esta mesma tabela já teve 3 casos
-- documentados de coluna/índice/lógica aplicados direto no SQL Editor
-- sem migration correspondente (ver 20260829000000, 20260903000000),
-- então substituir a função às cegas por cima do que está só no
-- arquivo de migration arrisca apagar em silêncio uma lógica de
-- agrupamento (`group_count`) que pode já existir só em produção.
-- =====================================================================

-- 1. `likes.target_type` — a constraint original (20260731000000) só
-- permitia 'comment'/'review'/'list'. 'post' e 'post_comment' existem
-- no app (LikeTargetType, apps/web/lib/queries/social/types.ts) desde
-- o Feed, mas nenhuma migration documentada estendeu essa constraint
-- — mesmo padrão de drift já visto nesta tabela. Curtir um post já
-- funciona hoje (o usuário confirmou: curtiu, só não notificou), o
-- que indica que isso já foi ajustado direto em produção; esta
-- recriação é só pra fechar o registro em migration, idempotente,
-- sem mudar comportamento.
alter table public.likes
  drop constraint if exists likes_target_type_check;
alter table public.likes
  add constraint likes_target_type_check
  check (target_type in ('comment', 'review', 'list', 'post', 'post_comment'));

-- 2. Novo tipo de notificação 'post_like' — lista base conferida na
-- última migration que tocou essa constraint (20260923010000_week_review_notifications.sql,
-- 9 tipos: comment_reply/comment_like/review_like/episode_new/
-- season_premiere/recommendation/new_follower/feedback_reply/
-- week_review), só acrescentando 'post_like' como décimo.
alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type = any (array['comment_reply', 'comment_like', 'review_like', 'episode_new', 'season_premiere', 'recommendation', 'new_follower', 'feedback_reply', 'week_review', 'post_like']));

-- 3. Preferência por tipo — mesmo padrão nullable das demais colunas
-- de `notification_preferences` (nula = ligado por padrão).
alter table public.notification_preferences
  add column if not exists post_like boolean;

-- 4. Agrupamento de curtida não lida — estende o índice existente
-- (20260903000000_notifications_indexes_backfill.sql) pra também
-- cobrir 'post_like', dando suporte a "N pessoas curtiram seu post"
-- assim que a função de trigger passar a usar upsert com esse
-- conflito (migration seguinte).
drop index if exists public.notifications_group_unread_idx;
create unique index if not exists notifications_group_unread_idx
  on public.notifications (user_id, type, target_id)
  where read_at is null and type = any (array['comment_like', 'review_like', 'post_like']);

notify pgrst, 'reload schema';
