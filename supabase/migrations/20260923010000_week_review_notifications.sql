-- =====================================================================
-- Notificação push "Sua semana no SeenList" (rodada 29, 2026-09-23) —
-- segundo passo da feature de pré-geração (rodada 28): o job semanal
-- (`week-review-pregenerate`, 14h Brasília) já calcula o destaque e a
-- frase com antecedência; esta migration prepara o banco pro passo
-- seguinte, um segundo job (`week-review-notify`, 15h Brasília,
-- confirmado com o usuário via AskUserQuestion) que lê o que foi
-- pré-gerado e insere uma linha em `notifications` por usuário — a
-- entrega em si continua sendo feita pelo `send-push-notifications`
-- já existente (cron de 2 em 2 minutos), sem nenhuma duplicação do
-- pipeline de envio.
--
-- Duas mudanças:
--   1. Coluna `title` em `week_review_pregenerated` — o job de
--      pré-geração já busca o título no TMDB pra gerar a frase; salvar
--      aqui evita `week-review-notify` ter que buscar de novo só pra
--      montar o texto da notificação.
--   2. `week_review` adicionado à lista de tipos permitidos em
--      `notifications.type` (mesma constraint que já ganhou
--      'feedback_reply' em 20260916000000).
-- =====================================================================

alter table public.week_review_pregenerated
  add column if not exists title text;

alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type = any (array['comment_reply', 'comment_like', 'review_like', 'episode_new', 'season_premiere', 'recommendation', 'new_follower', 'feedback_reply', 'week_review']));

notify pgrst, 'reload schema';
