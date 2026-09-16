-- A PEDIDO ("eu não consigo redimensionar o banner pra ficar do jeito
-- que eu quero", 2026-09-16) — o banner do perfil (`profiles.banner_url`,
-- uma cena/backdrop do TMDB escolhida da biblioteca do usuário, nunca
-- upload próprio) sempre foi cortado automaticamente no centro
-- (`object-cover`/`contentFit: cover`, sem controle nenhum de
-- enquadramento). Esta coluna guarda um ajuste vertical simples
-- (0 = topo da imagem, 0.5 = centro, 1 = base) que o usuário escolhe
-- arrastando um controle na tela de Editar perfil (mobile + web) —
-- ver `EditProfileView.tsx`/`edit-profile.tsx`.
--
-- `default 0.5`: mesma posição que o corte automático já sempre usou
-- (centro), então usuários existentes não veem NENHUMA mudança visual
-- até ajustarem manualmente.
--
-- `check (banner_focal_y >= 0 and banner_focal_y <= 1)`: mesmo
-- intervalo 0..1 que `contentPosition`/`object-position` esperam em
-- porcentagem — guarda a fração pronta pra virar "N%" na hora de
-- renderizar, sem conversão nenhuma no código de tela.
alter table public.profiles
  add column if not exists banner_focal_y real not null default 0.5
  check (banner_focal_y >= 0 and banner_focal_y <= 1);

notify pgrst, 'reload schema';
