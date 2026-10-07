-- =====================================================================
-- "Novidades" — notificação + tela de novidades (push + opções A e B do
-- mockup `https://claude.ai/artifact/3BdDGCGUffH4fygEYVdm7f`), a pedido
-- explícito do usuário: "quero sempre que tiver coisa nova, conseguir
-- mandar uma notificação de novidades pra os usuários".
--
-- Três decisões arquiteturais travadas via AskUserQuestion nesta sessão
-- (projeto proíbe decidir essas coisas sozinho):
--   1. Conteúdo fica numa TABELA (`whats_new_entries`), não hardcoded
--      no app — cada novidade futura é um INSERT novo via SQL, sem
--      precisar de nenhum app update.
--   2. Acesso à tela permanente (opção B) é um card FIXO dentro da
--      caixa de notificações já existente (sino, `app/notifications.tsx`),
--      não um ícone novo.
--   3. Escopo desta rodada: só mobile (decisão explícita do usuário,
--      mesmo depois de eu avisar que 81% da base só usa o site).
--
-- `profiles.whats_new_seen_at`: quando a pessoa viu a tela de novidades
-- pela última vez — sincronizado entre dispositivos (ao contrário de
-- uma flag só local). `null` = nunca viu. Comparado contra o
-- `created_at` da entrada mais recente de `whats_new_entries` pra
-- decidir a bolinha de "não visto" no card do sino e se o modal
-- comemorativo (uma vez, ao abrir o app) deve aparecer.
-- =====================================================================

create table public.whats_new_entries (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  -- Chave fixa que o app mapeia pro ícone/cor certos (ver `ICONS` em
  -- `apps/mobile/lib/whatsNew.ts`) — nunca um ícone livre/arbitrário,
  -- pra uma entrada com uma chave desconhecida cair num ícone padrão em
  -- vez de quebrar.
  icon_key text not null,
  created_at timestamptz not null default now()
);

alter table public.whats_new_entries enable row level security;

-- Precisa de SELECT direto pelo client (lista a tela de novidades e
-- compara contra `whats_new_seen_at` pra decidir a bolinha de "não
-- visto") — diferente do padrão "sem policy nenhuma, só servidor" usado
-- em `media_summaries_cache` (aquela tabela nunca é lida direto pelo
-- app, só por rotas server-side). Sem policy de insert/update/delete —
-- cadastro de novidade é só via SQL (dona do projeto), mesmo padrão já
-- usado pra atribuir `verified_tier`.
create policy "whats_new_entries_select_authenticated"
  on public.whats_new_entries
  for select
  to authenticated
  using (true);

alter table public.profiles
  add column if not exists whats_new_seen_at timestamptz;

-- Lista COMPLETA restaurada (regra do projeto: nunca restatar só o
-- valor novo) + 'whats_new' acrescentado no fim.
alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type = any (array[
    'comment_reply', 'comment_like', 'review_like', 'episode_new', 'season_premiere',
    'recommendation', 'new_follower', 'feedback_reply', 'week_review', 'post_like',
    'new_feedback', 'verified_badge', 'verified_badge_granted',
    'list_coowner_invite', 'list_coowner_accepted', 'list_coowner_declined', 'list_coowner_removed', 'list_coowner_left',
    'whats_new'
  ]));

-- As duas novidades desta rodada. Texto SEM qualquer menção a "IA" —
-- instrução explícita e permanente do usuário ("o usuário não precisa
-- saber disso"), já aplicada nos mockups desta mesma feature.
insert into public.whats_new_entries (title, description, icon_key) values
  ('Lista compartilhada', 'Convide alguém pra montar listas com você. Os dois podem adicionar e remover títulos — igual pros dois lados.', 'list-share'),
  ('Resumo da Temporada', 'Voltando depois de um tempo? Veja um resumo rápido de tudo que rolou na temporada anterior, antes de começar a próxima.', 'season-recap');

-- Notificação de lançamento, uma linha por usuário — mesmo padrão de
-- `20260929000008_verified_badge_notifications.sql` (broadcast único,
-- reaproveita o pipeline de push já existente).
--
-- SEM guarda de idempotência por `type = 'whats_new'`: diferente do
-- selo (um evento único, pra sempre), "novidades" é recorrente por
-- natureza — toda vez que tiver algo novo pra anunciar, uma NOVA
-- migration faz um INSERT igual a este. Uma guarda "not exists (...
-- type = 'whats_new')" travaria TODO envio futuro (o primeiro já
-- deixaria toda `user_id` com uma linha desse tipo). Reaplicar este
-- arquivo especificamente não é um risco real: o Supabase CLI rastreia
-- migrations já aplicadas e não roda esta de novo sozinho.
insert into public.notifications (user_id, type)
select p.user_id, 'whats_new'
from public.profiles p;

notify pgrst, 'reload schema';
