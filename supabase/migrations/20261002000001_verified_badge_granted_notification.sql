-- =====================================================================
-- A PEDIDO (2026-10-02) — notificação de selo concedido DEPOIS do
-- lançamento (29/09). O tipo `verified_badge` original
-- (`20260929000008_verified_badge_notifications.sql`) foi um envio
-- ÚNICO pra quem já tinha perfil naquela data, com texto fixo sobre o
-- "lançamento" ("chegaram os selos... primeiros 100 cadastrados") —
-- não faz sentido pra alguém que ganha o selo depois, numa atribuição
-- avulsa (ex.: eu.raylissonx@gmail.com, selo azul concedido agora —
-- ver `20261002000000_profiles_verified_tier_add_raylissonx.sql`).
--
-- Tipo novo `verified_badge_granted`, texto próprio ("você recebeu o
-- selo"), mesmo tratamento de ícone no client (selo do próprio
-- `verified_tier` do usuário, resolvido em `app/notifications.tsx` /
-- `NotificationsView.tsx` — ver as mudanças de código desta mesma
-- rodada). Diferente do tipo original, este NÃO é um envio único em
-- massa — é inserido manualmente, um por vez, toda vez que um selo é
-- concedido avulso (até existir UI de admin pra isso).
-- =====================================================================

alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type = any (array['comment_reply', 'comment_like', 'review_like', 'episode_new', 'season_premiere', 'recommendation', 'new_follower', 'feedback_reply', 'week_review', 'post_like', 'new_feedback', 'verified_badge', 'verified_badge_granted']));

-- Notificação pro primeiro caso: eu.raylissonx@gmail.com (user_id
-- 7ea49fe5-df70-467e-bf69-bfc7c6982adf), selo azul. Idempotente — não
-- duplica se já existir uma notificação `verified_badge_granted` pra
-- esse usuário.
insert into public.notifications (user_id, type)
select p.user_id, 'verified_badge_granted'
from public.profiles p
where p.user_id = '7ea49fe5-df70-467e-bf69-bfc7c6982adf'
and not exists (
  select 1 from public.notifications n
  where n.user_id = p.user_id and n.type = 'verified_badge_granted'
);

notify pgrst, 'reload schema';
