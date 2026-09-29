-- =====================================================================
-- BUG REAL, causado pela minha própria correção anterior (migration
-- 20260929000003) — "curti, descurti, curti de novo e não fez nada",
-- persistindo mesmo depois de 20260929000004.
--
-- CAUSA RAIZ: existem DUAS constraints parecidas na tabela
-- `notifications`, uma pra cada coluna — `notifications_type_check`
-- (coluna `type`: comment_like, review_like, post_like...) e
-- `notifications_target_type_check` (coluna `target_type`: comment,
-- review, profile...). Eu só tinha estendido a primeira
-- (20260929000002). A segunda, na última versão registrada
-- (20260916000000_feedback_replies.sql), permite só:
-- 'comment', 'review', 'profile', 'series', 'movie', 'recommendation',
-- 'user_feedback' — sem 'post'.
--
-- Quando `notify_like()` (corrigida em 20260929000003) passou a tentar
-- inserir `target_type = 'post'`, essa inserção batia direto nessa
-- constraint e falhava — e por estar num trigger AFTER INSERT em
-- `likes`, isso desfazia a curtida inteira (mesmo sintoma do bug
-- anterior, causa diferente). `20260929000004` (ON CONFLICT) não
-- resolvia isso porque o erro de CHECK constraint acontece ANTES de
-- qualquer resolução de conflito.
--
-- Lista completa preservada exatamente como estava (mesmo cuidado já
-- registrado em 20260916000000: reescrever só com o que EU sei que
-- deveria estar lá derrubaria valores que outras migrations já
-- adicionaram) — só acrescentando 'post' e 'post_comment' (esta
-- última pra já deixar pronto, já que o `likes.target_type` também a
-- permite, mesmo sem notify_like() tratar esse caso ainda).
-- =====================================================================

alter table public.notifications
  drop constraint if exists notifications_target_type_check;
alter table public.notifications
  add constraint notifications_target_type_check
  check (target_type = any (array['comment', 'review', 'profile', 'series', 'movie', 'recommendation', 'user_feedback', 'post', 'post_comment']));

notify pgrst, 'reload schema';
