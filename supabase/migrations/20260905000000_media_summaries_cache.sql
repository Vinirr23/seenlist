-- ACHADO DE PERFORMANCE (LCP "poor" de 9-11s em /series, confirmado
-- com dado real de celular, causa raiz isolada com instrumentação) —
-- a Biblioteca buscava o resumo (título/pôster/contagem de episódios)
-- de CADA série/filme no TMDB, um por um, toda vez que o cache de
-- 5 minutos do Next (por deployment/instância) estava frio — o caso
-- comum na carga do dia. Esta tabela é um cache de verdade,
-- COMPARTILHADO ENTRE TODOS OS USUÁRIOS: a primeira pessoa que abre
-- uma série popular esquenta o cache pra todas as outras que também
-- acompanham ela, não só pra ela mesma.
--
-- Só a rota `/api/tmdb/library-summaries` (servidor, via
-- createAdminClient/chave de serviço) lê e escreve aqui — por isso
-- RLS habilitado SEM NENHUMA policy: nem um usuário autenticado
-- consegue ler direto, é puramente um cache interno do servidor.
create table if not exists media_summaries_cache (
  media_type text not null check (media_type in ('movie', 'series')),
  tmdb_id integer not null,
  language text not null default 'pt-BR',
  title text not null,
  year integer,
  poster_path text,
  total_episodes integer,
  ended boolean,
  runtime_minutes integer,
  release_date text,
  genres text[],
  fetched_at timestamptz not null default now(),
  primary key (media_type, tmdb_id, language)
);

-- Cobre exatamente a consulta que a rota faz: filtra por
-- media_type + language, dentro da lista de ids, checando frescor.
create index if not exists media_summaries_cache_freshness_idx
  on media_summaries_cache (media_type, language, fetched_at);

alter table media_summaries_cache enable row level security;
-- Nenhuma policy de propósito — só a chave de serviço (que ignora
-- RLS) acessa esta tabela.
