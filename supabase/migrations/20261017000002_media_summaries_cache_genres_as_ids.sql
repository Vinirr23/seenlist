-- SeenList — media_summaries_cache.genres: nome traduzido → id TMDB
-- (2026-10-17, plano aprovado — item 8, "não quero critérios
-- dependentes de nomes traduzidos que possam mudar conforme o
-- idioma").
--
-- ACHADO (lendo `apps/web/lib/tmdb/client.ts`, `getMovieSummary`/
-- `getSeriesSummary`) — o TMDB já devolve `genres: {id, name}[]`; o
-- `id` está na MESMA resposta que já é usada hoje, só é descartado
-- na hora de montar `MediaSummary` (`.map((g) => g.name)`). Trocar
-- pra id NÃO exige nenhuma chamada nova ao TMDB.
--
-- POR QUE ISTO IMPORTA DE VERDADE — o nome é gravado JÁ TRADUZIDO
-- (`language` é parte da chave primária da tabela), então "Drama" em
-- pt-BR e "Drama" em en são o mesmo texto por coincidência, mas
-- "Comédia" (pt-BR) e "Comedy" (en) são strings diferentes pro mesmo
-- gênero — qualquer critério de emblema que comparasse por nome
-- quebraria conforme o idioma de quem alimentou aquele cache. Id é
-- estável entre idiomas (confirmado: Drama=18 e Comédia/Comedy=35 são
-- o MESMO id tanto na lista de gênero de filme quanto na de série no
-- TMDB — já existe inclusive um bug documentado em
-- `favorite-genres.ts` sobre id de gênero DIFERIR entre filme/série
-- pra outros gêneros, ex. Ação=28 só em filme — então usar id em vez
-- de nome, aqui, evita essa classe de erro, não introduz uma nova).
--
-- COLUNA RECRIADA, NÃO CONVERTIDA — não dá pra `cast` texto
-- ("Drama") pra inteiro (18) sem uma tabela de tradução inversa por
-- idioma, e não vale o esforço: a tabela já é um CACHE, repopula
-- sozinha (mesmo princípio de `genres`/`year`/`production_countries`
-- — nenhuma garantia de cobertura imediata de 100% do histórico,
-- sempre dependeu de reabertura do título ou do job de
-- enriquecimento). Dropar e recriar vazio é seguro.
--
-- IMPORTANTE — isto NÃO muda o contrato da API
-- (`/api/tmdb/library-summaries`): o endpoint continua devolvendo
-- NOME traduzido pro idioma pedido (ver mudança em `route.ts`), só
-- resolvido NA LEITURA via o mapa id→nome que já existe
-- (`buildGenreMaps`/`/api/tmdb/genres`, já cacheado 1 dia) em vez de
-- vir gravado junto com o dado. Conferido antes desta migration: o
-- único consumidor real encontrado (`favorite-genres.ts`, "Seus
-- gêneros favoritos"/"Para você") já espera `genres: string[]`
-- (nomes) da resposta da API — continua funcionando sem nenhuma
-- mudança, porque o contrato da API não mudou, só o armazenamento
-- interno. Nenhum outro consumidor é possível: a tabela tem RLS SEM
-- NENHUMA policy pra usuário autenticado (migration `20260905000000`)
-- — só a chave de serviço do endpoint lê/escreve aqui.
alter table public.media_summaries_cache
  drop column if exists genres;

alter table public.media_summaries_cache
  add column genres integer[];

comment on column public.media_summaries_cache.genres is
  'Ids de gênero TMDB (não nomes — ver migration 20261017000002 pra causa raiz completa: nome traduzido por idioma quebrava qualquer comparação entre contas em idiomas diferentes). Resolver nome pra exibição via buildGenreMaps()/`/api/tmdb/genres`, nunca gravar nome aqui de novo.';

notify pgrst, 'reload schema';
