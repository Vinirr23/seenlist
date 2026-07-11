-- =====================================================================
-- TASK-069 (integração) — tabela pra guardar os e-mails da página
-- /beta. `email` é `unique` — quem já se cadastrou não gera linha
-- duplicada (o formulário trata isso como sucesso mesmo assim, não
-- como erro, ver page.tsx). Sem `user_id`: quem preenche esse
-- formulário não tem conta nenhuma ainda, é justamente o público que
-- a beta está tentando captar.
--
-- RLS: só permite INSERT público (`anon`/`authenticated` — qualquer
-- visitante do site, sem estar logado). Nenhuma policy de SELECT —
-- ninguém consegue LER a lista de e-mails pela chave pública do
-- Supabase; só dá pra consultar pelo painel do Supabase (Table
-- Editor / SQL Editor), que usa a service role e ignora RLS.
-- =====================================================================

create table if not exists public.beta_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

alter table public.beta_signups enable row level security;

drop policy if exists "qualquer pessoa pode entrar na lista de espera" on public.beta_signups;
create policy "qualquer pessoa pode entrar na lista de espera"
  on public.beta_signups for insert
  to anon, authenticated
  with check (true);

notify pgrst, 'reload schema';
