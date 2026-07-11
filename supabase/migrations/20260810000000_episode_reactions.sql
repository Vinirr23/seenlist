-- =====================================================================
-- TASK-067 — experiência pós-"assistido" no episódio, inspirada no
-- TV Time: "onde você assistiu", avaliação com estrelas, "como você
-- se sentiu" e "personagem favorito". Tudo isso é reação da PESSOA
-- ao episódio — mesma linha/mesma constraint única de sempre
-- (user_id, media_type, media_id, season_number, episode_number) já
-- usada por `reviews` pra nota/texto — por isso vira colunas novas
-- nessa tabela, não uma tabela separada. `favorite_character_name`
-- guarda uma cópia do nome (não só o id): o elenco vem do TMDB, que
-- não é garantidamente estável entre consultas/idiomas — sem a
-- cópia, mostrar "quem foi seu personagem favorito" de novo mais
-- tarde dependeria de bater o id contra uma consulta nova ao TMDB
-- que pode nem retornar o mesmo elenco.
-- =====================================================================

alter table public.reviews add column if not exists mood text;
alter table public.reviews add column if not exists favorite_character_id integer;
alter table public.reviews add column if not exists favorite_character_name text;
alter table public.reviews add column if not exists watched_platform text;

-- `rating not null` (20260731000000) impedia salvar só "onde
-- assistiu"/"humor"/"personagem favorito" antes de dar qualquer
-- nota — a linha de review é criada na primeira interação, seja
-- qual for; precisa poder existir sem nota ainda.
alter table public.reviews alter column rating drop not null;
