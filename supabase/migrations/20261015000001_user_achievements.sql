-- SeenList — user_achievements
--
-- REAL (2026-10-15, a pedido — "Implementar o desbloqueio real dos 4
-- primeiros") — substitui o estado de demonstração que vivia só em
-- `apps/mobile/lib/achievements.ts` (DEMO_UNLOCKED/DEMO_PROGRESS/
-- DEMO_UNLOCKED_AT, sem banco nenhum por trás). Guarda, de forma
-- PERSISTENTE, quais emblemas cada usuário já desbloqueou — decisão
-- explícita do usuário (via pergunta direta): tabela nova, não
-- recálculo a cada leitura. Isso sobrevive mesmo que o dado-fonte que
-- originou o desbloqueio (um episódio assistido, por exemplo) seja
-- apagado depois — uma vez conquistado, continua conquistado.
--
-- `achievement_id` com `check` fechado nos 4 emblemas já aprovados
-- (mesmo escopo do piloto em `lib/achievements.ts` — "não avance para
-- os outros 24 emblemas"). Quando os outros 24 entrarem, esta
-- constraint precisa de uma migration própria pra abrir a lista.
--
-- SEM policy de insert/update/delete pro cliente autenticado, DE
-- PROPÓSITO — só a função `evaluate_and_unlock_achievements`
-- (SECURITY DEFINER, próxima migration) grava aqui. Isso impede que o
-- próprio app (ou qualquer chamada direta via supabase-js) force um
-- desbloqueio sem checar o critério de verdade no banco.
create table public.user_achievements (
  user_id uuid not null references auth.users (id) on delete cascade,
  achievement_id text not null check (
    achievement_id in ('maratonista', 'madrugada', 'amante-de-filmes', 'classicos')
  ),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create index user_achievements_user_idx on public.user_achievements (user_id);

alter table public.user_achievements enable row level security;

create policy "usuário vê apenas as próprias conquistas"
  on public.user_achievements for select
  using (auth.uid() = user_id);

-- Nenhuma policy de insert/update/delete pro cliente — ver comentário
-- no topo do arquivo.
