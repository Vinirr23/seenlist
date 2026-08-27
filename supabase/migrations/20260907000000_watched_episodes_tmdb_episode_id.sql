-- SeenList — watched_episodes: coluna tmdb_episode_id (motor de
-- casamento resistente a reestruturação de temporadas pela TMDB)
--
-- CONTEXTO (2026-08-26, investigação real — "Solo
-- Leveling/Rent-a-Girlfriend/Dan Da Dan/Kaiju No. 8 com episódios
-- aparecendo como não assistidos, sempre a partir do episódio 13"):
-- a causa raiz confirmada (print de tela + cruzado com a própria
-- TMDB) foi a TMDB tendo FUNDIDO temporadas desses animes — cada um
-- lançado em "cours" separados foi gravado aqui como temporadas 1 e
-- 2 distintas (na importação original), mas a TMDB hoje devolve tudo
-- como "temporada 1" só, numeração contínua. Como a identidade de um
-- episódio assistido hoje é (season_number, episode_number) — e essa
-- numeração pode mudar quando a TMDB reestrutura uma série — a conta
-- de "está em dia?" para de bater mesmo com o episódio de fato
-- assistido: ele só "some" porque o par (temporada, episódio)
-- antigo não existe mais na estrutura atual da TMDB.
--
-- Esta migração NÃO resolve isso sozinha, nem muda nada do que já
-- funciona — só abre espaço pra próxima etapa: uma coluna nova,
-- opcional (nullable), guardando o ID PERMANENTE do episódio na
-- TMDB (esse sim nunca muda, mesmo quando a TMDB reagrupa
-- temporadas). Nenhuma coluna existente, chave primária ou política
-- de RLS é alterada — todo o código atual (marcar, desmarcar,
-- reassistir episódio) continua funcionando exatamente igual,
-- porque ele nem usa esta coluna ainda.
--
-- Próximos passos (fora desta migração): o código passa a GRAVAR
-- este ID sempre que um episódio for marcado como assistido a partir
-- de agora; um backfill preenche as linhas antigas (trivial pras
-- séries sem o problema de temporada fundida — a maioria; pras
-- afetadas, precisa da API de "Episode Groups" da TMDB pra achar o
-- ID certo); e a recalculação de status/tela de temporada passam a
-- preferir bater por este ID quando ele existir, só caindo pra
-- (season_number, episode_number) nas linhas antigas sem ele — assim
-- uma futura fusão de temporada pela TMDB não quebra de novo o que
-- já foi assistido.

alter table public.watched_episodes
  add column if not exists tmdb_episode_id bigint;

comment on column public.watched_episodes.tmdb_episode_id is
  'ID permanente do episódio na TMDB — sobrevive a qualquer reestruturação de temporadas feita pela própria TMDB (diferente de season_number/episode_number, que podem mudar). Nullable: linhas gravadas antes desta migração ficam null até o backfill; o código novo passa a preencher em toda gravação a partir de agora. Usado como identidade preferencial de "assistido" na recalculação de categoria e na tela de temporada — cai para (season_number, episode_number) só quando ausente.';

-- Índice parcial (só onde não é null) — usado pra achar rapidamente,
-- dentro de uma série, se um ID de episódio específico já está
-- marcado como assistido, sem precisar escanear linhas antigas que
-- ainda não têm o backfill.
create index if not exists watched_episodes_tmdb_episode_id_idx
  on public.watched_episodes (series_id, tmdb_episode_id)
  where tmdb_episode_id is not null;
