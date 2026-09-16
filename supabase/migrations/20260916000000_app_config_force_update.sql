-- =====================================================================
-- In-app update do Google Play (a pedido, 2026-09-16, antes de mandar
-- a atualização atual pra Play Store) — o app agora checa sozinho se
-- existe uma versão mais nova publicada na Play Store (usando o Play
-- Core, via `sp-react-native-in-app-updates`) e sugere/pede pra
-- atualizar. Por padrão o update é FLEXÍVEL (baixa em segundo plano,
-- só pede pra reiniciar quando termina) — decisão do usuário, via
-- AskUserQuestion: "os dois (flexível por padrão, imediata quando eu
-- marcar)".
--
-- Esta tabela é o interruptor manual pra virar IMEDIATO (tela cheia,
-- trava o app até atualizar) quando uma versão tiver um bug crítico
-- que precise forçar todo mundo a atualizar. Fora isso, fica sempre
-- `false` (flexível).
--
-- Singleton (1 linha só): `id boolean primary key default true check
-- (id)` — trava por constraint que só pode existir a linha
-- `id = true`, sem precisar de trigger nem de UNIQUE INDEX parcial.
--
-- RLS: só SELECT público (o app lê, sem login nenhum — a checagem
-- roda antes/depois de qualquer tela de auth) — nenhuma policy de
-- INSERT/UPDATE/DELETE pública. Pra ligar o modo imediato, mude a
-- linha direto no Supabase (Table Editor: marca
-- `force_update_android` como `true`) ou pelo SQL Editor:
--
--   update public.app_config set force_update_android = true, updated_at = now();
--
-- E pra voltar ao normal (flexível):
--
--   update public.app_config set force_update_android = false, updated_at = now();
-- =====================================================================

create table if not exists public.app_config (
  id boolean primary key default true,
  check (id),
  force_update_android boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.app_config (id, force_update_android)
values (true, false)
on conflict (id) do nothing;

alter table public.app_config enable row level security;

drop policy if exists "leitura pública da config do app" on public.app_config;
create policy "leitura pública da config do app"
  on public.app_config for select
  to public
  using (true);

notify pgrst, 'reload schema';
