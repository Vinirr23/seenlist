-- A PEDIDO (2026-09-29) — "selo de verificação" (verified badge): o
-- próprio usuário (conta oficial do SeenList) recebe o selo "gold",
-- e uma lista inicial de early adopters recebe o selo "blue". Sem UI
-- de admin por enquanto — atribuição manual via SQL (ver migration
-- seguinte, 20260929000001).
--
-- `text` + `check` em vez de um enum Postgres: um enum exigiria uma
-- migration `alter type ... add value` para qualquer tier novo no
-- futuro (e não pode ser removido/reordenado facilmente); um `check`
-- é uma alteração simples de tabela, no mesmo padrão de baixo custo
-- já usado nas outras migrations desta pasta.

alter table public.profiles
  add column if not exists verified_tier text;

alter table public.profiles
  drop constraint if exists profiles_verified_tier_check;

alter table public.profiles
  add constraint profiles_verified_tier_check
  check (verified_tier is null or verified_tier in ('gold', 'blue'));

comment on column public.profiles.verified_tier is
  'Selo de verificação exibido ao lado do nome: ''gold'' (conta oficial), ''blue'' (verificado), ou null (não verificado). Atribuído manualmente via SQL, sem UI de admin.';
