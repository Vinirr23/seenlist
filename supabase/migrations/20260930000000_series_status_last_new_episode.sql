-- SeenList — series_status: sinal separado pra "ganhou episódio novo"
-- (2026-09-30)
--
-- CONTEXTO — usuário pediu que "Continue assistindo" ordene por
-- "última alteração" E "novo episódio lançado" (o que for mais
-- recente). Hoje só existe `updated_at`, e o recálculo automático
-- (`recalculateUpToDateSeriesCategories`, roda ao focar a aba Séries,
-- no máximo 1x/2h) já regrava `updated_at` pra TODA série "watching"
-- mesmo sem nenhuma mudança real — decisão de propósito, documentada
-- em `shouldWriteSeriesCategory` (mobile e web), pra série não afundar
-- no corte de 8 vagas de "Continue assistindo" só por ficar muito
-- tempo sem categoria mudar. Efeito colateral: `updated_at` não
-- distingue "ganhou episódio novo de verdade" de "só foi conferido de
-- novo" — a maioria das séries "watching" acaba com o MESMO
-- `updated_at` (o do último recálculo em lote), tenha saído episódio
-- novo ou não.
--
-- Duas colunas novas, 100% ADITIVAS — nenhuma coluna, gatilho, RPC ou
-- comportamento já existente muda (race guard, last_activity_at,
-- auto-pause de 30 dias, tudo continua exatamente igual):
--
--   last_known_aired_count: quantos episódios NÃO-especiais já tinham
--     saído (aired) da última vez que o recálculo conferiu esta
--     série. Só usado internamente por essa rotina, pra comparar
--     "antes vs. agora" — nunca lido pela UI.
--
--   last_new_episode_at: carimbado só quando essa contagem SOBE de
--     verdade (episódio novo detectado) — nunca em toda passada do
--     recálculo, ao contrário de `updated_at`.
--
-- Nulas por padrão, sem backfill nenhum: a primeira vez que o
-- recálculo vir uma série sem esse dado (toda a biblioteca já
-- existente, no dia em que isso for pro ar), ele só INICIALIZA
-- `last_known_aired_count` (sem carimbar `last_new_episode_at`) — não
-- dá pra saber se um episódio "é novo" sem ter uma contagem anterior
-- pra comparar, e tratar a ausência de dado como "acabou de sair
-- episódio novo" carimbaria a data de hoje em toda a biblioteca de
-- todo mundo de uma vez, o que é claramente errado. Mesma regra vale
-- pra série recém-adicionada à biblioteca (não trata os episódios que
-- já existiam antes de você começar a assistir como "novos").

alter table public.series_status
  add column if not exists last_known_aired_count integer;

alter table public.series_status
  add column if not exists last_new_episode_at timestamptz;

comment on column public.series_status.last_known_aired_count is
  'Quantos episódios não-especiais já tinham saído (aired) da última vez que recalculateUpToDateSeriesCategories (mobile/web) conferiu esta série. Nulo = nunca conferido ainda (série pré-existente antes desta migration, ou recém-adicionada). Só usado internamente por essa rotina pra comparar "antes vs. agora" — nunca lido pela UI.';

comment on column public.series_status.last_new_episode_at is
  'Timestamp de quando last_known_aired_count subiu de verdade (episódio novo genuinamente detectado) — nunca em toda passada do recálculo, ao contrário de updated_at. Usado junto com updated_at na ordenação de "Continue assistindo": mostra em cima quem teve atividade real mais recente, seja "você mexeu na série" (updated_at) ou "saiu episódio novo" (last_new_episode_at), o que for mais recente.';

notify pgrst, 'reload schema';
