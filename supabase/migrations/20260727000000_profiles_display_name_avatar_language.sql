-- Correção de investigação — a tabela `profiles` JÁ EXISTE desde a
-- TASK-028 (20260720000000_social_profile.sql), com trigger de
-- criação automática e RLS funcionando. O sintoma relatado ("profiles
-- não existe") bate com a mesma causa raiz de outra investigação
-- anterior nesta mesma migration: ela tinha um bug de ordenação
-- (policy referenciando `follows` antes de `follows` existir) que já
-- foi corrigido no próprio arquivo. Se o erro "profiles não existe"
-- ainda está acontecendo, o mais provável é que a migration corrigida
-- nunca chegou a ser reaplicada no banco real — não que a tabela
-- nunca tenha sido definida no código.
--
-- Por isso esta migration NÃO recria `profiles` (isso quebraria com
-- "relation already exists" assim que a 20260720000000 for aplicada,
-- e descartaria trigger/RLS que já funcionam) — ela ESTENDE a tabela
-- existente com os campos que realmente faltavam, comparando contra
-- o pedido:
--
-- id             → adicionado (ver abaixo).
-- user_id        → já existe (é a própria chave primária).
-- username       → já existe.
-- display_name   → adicionado (não existia em lugar nenhum — nome
--                   hoje mora só em auth.users.user_metadata.full_name,
--                   que outros usuários NUNCA conseguem ler via RLS;
--                   é por isso que o perfil público de outra pessoa
--                   nunca mostrava o nome de verdade, só o username).
-- bio            → já existe.
-- avatar_url     → adicionado (mesmo problema do display_name —
--                   hoje só em user_metadata.avatar_url).
-- banner_url     → já existe.
-- language       → adicionado (não existia; preferência de idioma
--                   hoje só vive no navegador, via LocaleProvider).
-- is_public      → NÃO adicionado como campo novo. Já existe
--                   `profile_visibility` ('public'/'followers'/
--                   'private') — mais granular que um booleano.
--                   Adicionar um `is_public` redundante criaria duas
--                   fontes de verdade conflitantes pra mesma coisa.
-- created_at     → já existe.
-- updated_at     → já existe.

alter table public.profiles
  add column if not exists id uuid not null default gen_random_uuid() unique,
  add column if not exists display_name text,
  add column if not exists avatar_url text,
  add column if not exists language text not null default 'pt-BR';

comment on column public.profiles.id is
  'Identificador opaco adicional, além de user_id (que continua sendo a chave primária/estrangeira natural). Existe pra funcionalidades sociais futuras que prefiram referenciar um perfil sem expor user_id diretamente.';
comment on column public.profiles.display_name is
  'Nome de exibição público. Sincronizado a partir de auth.users.user_metadata.full_name nas ações de alterar nome (lib/actions/account.ts) — é a nova fonte de verdade pra QUALQUER usuário conseguir ver o nome de outro (user_metadata nunca foi público via RLS).';
comment on column public.profiles.avatar_url is
  'URL do avatar público. Sincronizado a partir de auth.users.user_metadata.avatar_url no upload de foto (lib/queries/avatar-upload.ts) — mesmo motivo do display_name.';

-- Backfill: preenche display_name/avatar_url pra quem já tem conta,
-- puxando do auth.users.user_metadata (a fonte atual) — sem isso,
-- todo usuário existente ficaria com os campos novos vazios até a
-- próxima vez que alterasse nome/foto manualmente.
update public.profiles p
set
  display_name = coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
  avatar_url = u.raw_user_meta_data ->> 'avatar_url'
from auth.users u
where u.id = p.user_id
  and p.display_name is null
  and p.avatar_url is null;

-- =================================================================
-- Trigger de criação atualizada — passa a copiar display_name/avatar
-- de user_metadata já na criação do perfil (quando existir; login
-- social como Google já manda isso no cadastro).
-- =================================================================
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, username, display_name, avatar_url)
  values (
    new.id,
    public.generate_unique_username(new.email),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

notify pgrst, 'reload schema';
