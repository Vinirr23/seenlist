-- =====================================================================
-- TASK-076 — tela de "Enviar feedback" em Configurações, pros
-- testadores da beta mandarem bug/sugestão/comentário direto pelo
-- app, em vez de depender de WhatsApp/e-mail espalhado. `user_id`
-- referencia quem enviou (sempre logado — a tela fica dentro de
-- Configurações, que já exige login); `email`/`name` NÃO são
-- guardados aqui de novo, dá pra buscar em `profiles`/`auth.users`
-- pelo `user_id` se precisar entrar em contato.
--
-- RLS: só INSERT público (qualquer usuário autenticado manda o
-- próprio feedback) — nenhuma policy de SELECT, ninguém consegue ler
-- a lista de feedbacks pela chave pública; só você, direto no
-- Supabase (Table Editor / SQL Editor), que usa a service role.
-- =====================================================================

create table if not exists public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('bug', 'suggestion', 'other')),
  message text not null check (char_length(message) between 1 and 2000),
  created_at timestamptz not null default now()
);

alter table public.user_feedback enable row level security;

drop policy if exists "usuário logado envia o próprio feedback" on public.user_feedback;
create policy "usuário logado envia o próprio feedback"
  on public.user_feedback for insert
  to authenticated
  with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
