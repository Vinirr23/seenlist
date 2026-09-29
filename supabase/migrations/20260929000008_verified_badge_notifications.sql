-- =====================================================================
-- A PEDIDO (2026-09-29) — notificação de lançamento do selo de
-- verificação. Decisões do usuário (confirmadas em rodada de
-- perguntas, ver sessão "selo de verificação"):
--
-- 1. TODOS os usuários recebem a MESMA notificação — texto único
--    "variante C" (com efeito FOMO), sem diferenciar quem é gold,
--    blue ou sem selo nenhum. Não há branching de mensagem por
--    `verified_tier` — o texto condicional ("se você foi um dos
--    primeiros 100...") já cobre os três casos sozinho.
-- 2. Ícone: quem TEM selo mostra o próprio selo (dourado/azul) no
--    lugar do sininho — resolvido no client, lendo o `verified_tier`
--    do próprio usuário logado (`useCurrentUser`), não precisa de
--    coluna nova aqui. Quem NÃO tem selo continua com o sininho
--    padrão (fallback já existente pra notificação sem ator/mídia).
-- 3. Push também, pra todo mundo, mesmo texto — ver
--    `send-push-notifications/index.ts`, novo `case "verified_badge"`.
-- 4. Traduzido pt-BR/en/es — ver `translations.ts` dos dois apps.
-- 5. Envio único (não recorrente): esta migration já insere as linhas
--    direto, reaproveitando o pipeline de push existente (que roda
--    periodicamente e entrega qualquer notificação com `pushed_at`
--    nulo) — não precisou de function nova nenhuma.
--
-- Base da constraint conferida na ÚLTIMA migration que tocou
-- `notifications_type_check` no arquivo local em disco na hora desta
-- escrita — `20260929000007_new_feedback_notification.sql`, 11 tipos
-- (comment_reply/comment_like/review_like/episode_new/season_premiere/
-- recommendation/new_follower/feedback_reply/week_review/post_like/
-- new_feedback) — só acrescentando 'verified_badge' como décimo
-- segundo.
-- =====================================================================

alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type = any (array['comment_reply', 'comment_like', 'review_like', 'episode_new', 'season_premiere', 'recommendation', 'new_follower', 'feedback_reply', 'week_review', 'post_like', 'new_feedback', 'verified_badge']));

-- Envio único pra todo mundo — sem ator, sem alvo (não linka pra
-- comentário/review/post nenhum; o link no front-end vai pro próprio
-- perfil, "/profile"). Idempotente: se esta migration rodar de novo
-- (reaplicação manual, por exemplo), não duplica a notificação de
-- quem já recebeu.
insert into public.notifications (user_id, type)
select p.user_id, 'verified_badge'
from public.profiles p
where not exists (
  select 1 from public.notifications n
  where n.user_id = p.user_id and n.type = 'verified_badge'
);

notify pgrst, 'reload schema';
