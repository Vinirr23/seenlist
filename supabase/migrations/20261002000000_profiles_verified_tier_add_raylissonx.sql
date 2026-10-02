-- A PEDIDO (2026-10-02) — selo azul pro usuário de e-mail
-- eu.raylissonx@gmail.com (não fazia parte da lista original dos 100
-- primeiros cadastrados, atribuída em 2026-09-29 — ver
-- `20260929000001_profiles_verified_tier_backfill.sql`). Localizado
-- por E-MAIL (`auth.users.email`), não por username — `public.profiles`
-- não guarda e-mail diretamente (só `auth.users` tem essa coluna; a
-- ligação é `profiles.user_id = auth.users.id`).
--
-- Idempotente — pode rodar de novo sem duplicar efeito. Não falha se
-- o e-mail não existir (a subquery devolve `null`, `update` afeta 0
-- linhas) — mas isso significaria que a conta ainda não existe nesse
-- e-mail; conferir com `select id from auth.users where email = '...'`
-- antes, se o resultado parecer "0 rows affected".
update public.profiles
set verified_tier = 'blue'
where user_id = (select id from auth.users where email = 'eu.raylissonx@gmail.com');
