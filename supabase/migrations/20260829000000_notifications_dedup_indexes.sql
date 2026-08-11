-- Índices de deduplicação da tabela `notifications` — nunca
-- existiram de verdade, apesar do código (`check-new-releases`) já
-- presumir que sim há tempo, com comentário citando os nomes
-- exatos (`notifications_dedup_episode_idx`/`_season_idx`).
--
-- CAUSA RAIZ (achada rodando a função de verdade, depois de corrigir
-- timeout + autenticação do TMDB): toda tentativa de inserir
-- notificação de episódio novo falhava com
-- `42P10: there is no unique or exclusion constraint matching the ON
-- CONFLICT specification` — o `upsert(...).onConflict(...)` no
-- código está correto, só não tinha contra o que bater no banco.
--
-- Confirmado também: a migration original de `notifications`
-- (20260731000000) nem tem as colunas que o código usa
-- (`target_media_id`, `target_season_number`,
-- `target_episode_number`, `payload`, `pushed_at`) — foram
-- adicionadas direto em produção, fora de qualquer migration (mesmo
-- padrão já visto em `posts`/`push_tokens` neste projeto). Como o
-- INSERT chegou a ser tentado (só falhou no ON CONFLICT, não em
-- "coluna não existe"), essas colunas seguramente já existem — esta
-- migration só adiciona os ÍNDICES que faltavam, nada mais.
--
-- DOIS índices parciais, não um só, de propósito: `season_premiere`
-- grava `target_episode_number: null` — num índice único comum,
-- NULL nunca é igual a NULL pro Postgres (duas linhas com NULL na
-- mesma coluna não violam unicidade), então um índice único
-- incluindo essa coluna deixaria duplicata de estreia de temporada
-- passar batido. Separar por tipo (`where type = ...`) resolve os
-- dois casos corretamente.

create unique index if not exists notifications_dedup_episode_idx
  on public.notifications (user_id, target_media_id, target_season_number, target_episode_number)
  where type = 'episode_new';

create unique index if not exists notifications_dedup_season_idx
  on public.notifications (user_id, target_media_id, target_season_number)
  where type = 'season_premiere';
