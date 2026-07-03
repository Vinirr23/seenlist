# SeenList

Base do projeto — TASK-001. Monorepo organizado, sem nenhuma
funcionalidade de produto implementada ainda.

## Rodando

```bash
pnpm install
pnpm dev            # roda apps/web e apps/mobile via Turborepo
pnpm --filter @seenlist/web dev     # só o web
pnpm --filter @seenlist/mobile dev  # só o mobile (Expo)
```

> **Sobre "npm install funcionando"** (critério de aceitação): o
> monorepo usa pnpm workspaces + Turborepo (já configurado nas tarefas
> anteriores — "Turborepo (caso já esteja configurado)"). `pnpm
> install` é o equivalente correto aqui; `npm install` sozinho não
> resolve os pacotes `workspace:*`. Sinalizando essa interpretação
> porque o documento não deixa 100% explícito qual gerenciador usar.

## Estrutura

```
apps/
  web/        Next.js 15 (App Router) — só o esqueleto, sem telas
  mobile/      Expo (Expo Router) — estrutura preparada, sem telas
packages/
  ui/           Button, Input, Card, Poster, Avatar, Badge, Modal —
                 só estrutura, sem lógica/estilo complexo
  types/         vazio nesta fase (sem banco de dados ainda)
  utils/          só o helper `cn()` (merge de classNames)
  hooks/           vazio nesta fase
  config/           tokens de cor + preset de ESLint compartilhados
supabase/            config mínimo do CLI, sem schema
docs/                 nota sobre o reset e onde está o trabalho anterior
```

## Tema

Só os tokens de cor globais (tema escuro), em
`packages/config/src/tailwind-tokens.ts`:
`background`, `surface`, `primary`, `secondary`, `text`, `muted`,
`border`, `success`, `warning`, `danger`. Nenhuma tela usa esses
tokens ainda além do placeholder mínimo em `apps/web/app/page.tsx`.

## Padronização

- **TypeScript estrito** em todos os pacotes (`tsconfig.base.json`)
- **ESLint** (flat config, Next 15 + preset compartilhado em
  `packages/config/src/eslint-preset.mjs`)
- **Prettier** (raiz, com plugin de ordenação de classes Tailwind)
- **EditorConfig** (raiz)
- **Aliases**: `@seenlist/*` entre pacotes, `@/*` dentro de cada app
- **Variáveis de ambiente**: `.env.example` na raiz (placeholders do
  Supabase — projeto ainda não criado)

## Autenticação (TASK-002)

Implementado com Supabase Auth + `@supabase/ssr`, direto em
`apps/web` (sem pacote `@seenlist/auth` — não foi pedido nesta
tarefa).

- **Rotas**: `/login`, `/register`, `/forgot-password` — layout
  compartilhado em `app/(auth)/layout.tsx`.
- **`/auth/callback`**: não é uma tela, é o route handler que troca o
  `code` por sessão — necessário para OAuth do Google, confirmação de
  cadastro por e-mail e o link de recuperação de senha funcionarem.
- **`/forgot-password` tem dois modos** na mesma rota (decidido no
  servidor, olhando se há sessão ativa): sem sessão → formulário para
  pedir o link; com sessão (chegou aqui pelo link do e-mail) →
  formulário para definir a senha nova. Isso evita precisar de uma
  4ª rota que o TASK-002 não autorizou, mantendo o fluxo de
  recuperação de senha completo mesmo assim.
- **Middleware** (`middleware.ts` + `lib/supabase/middleware.ts`):
  renova a sessão a cada request; qualquer rota fora de
  `/login /register /forgot-password /auth/callback` exige sessão
  (hoje só existe `"/"`, mas a regra vale para rotas futuras sem
  precisar mexer no middleware de novo); `/login` e `/register`
  redirecionam para `"/"` se já estiver autenticado — `/forgot-password`
  fica de fora dessa regra de propósito (ver ponto acima).
- **`"/"`** ganhou só o necessário para provar que a auth funciona de
  ponta a ponta (e-mail do usuário + botão de logout) — continua sem
  ser uma tela de Home.

**Configuração necessária no painel do Supabase** (fora do escopo do
código, mas necessária pra funcionar): habilitar o provider Google em
Authentication → Providers, e cadastrar
`{SITE_URL}/auth/callback` como Redirect URL — tanto localmente
(`http://localhost:3000/auth/callback`) quanto em produção.

## Layout principal + Bottom Navigation (TASK-003)

- **4 abas**: Séries (`/series`), Filmes (`/movies`), Explorar
  (`/explore`), Perfil (`/profile`) — todas vazias, só título +
  descrição + comentário marcando onde a funcionalidade futura entra.
  Config única em `apps/web/lib/navigation.ts`.
- **Componentes reutilizáveis** em `apps/web/components/layout/`:
  `BottomNavigation` (calcula a aba ativa via `usePathname`, uma vez
  só), `BottomNavigationItem` (item burro, recebe `active` por prop),
  `PageContainer`, `ScreenHeader`.
- **Destino pós-login mudou de `/` para `/series`** — TASK-002 mandava
  pra `/`, mas agora `/` não tem tela própria: só redireciona pra
  `/series`. Atualizei os 3 redirects em `lib/actions/auth.ts` e o
  redirect de "já autenticado" no middleware.
- **Logout** saiu do corpo da página (não existe mais tela em `/`) e
  foi para a barra superior do layout principal
  (`app/(main)/layout.tsx`) — é chrome do layout, não uma feature de
  perfil, então não conflita com "não implemente perfil".
- **Só Web nesta tarefa.** O documento pede "funcionar em Web e
  Mobile", mas não lista nenhuma tela/rota do Expo nem menciona
  `apps/mobile` — não toquei em `apps/mobile` para não presumir
  escopo que não foi pedido. Fica sinalizado: a Bottom Navigation
  mobile (Expo) ainda não existe.
- Sem sidebar alternativa pra telas largas — a mesma bottom nav fixa
  vale pra qualquer largura, conforme "mobile first" e sem pedido
  explícito de um layout diferente pra desktop.

## Pesquisa + TMDB (TASK-004)

- **Client TMDB centralizado**: `apps/web/lib/tmdb/client.ts` é o
  único módulo que fala com `api.themoviedb.org` — usa
  `TMDB_API_KEY` (só servidor). Nenhum componente chama o TMDB
  direto.
- **A API key nunca chega ao browser**: o client só roda em
  `apps/web/app/api/search/route.ts` (Route Handler). O client-side
  (React Query) chama essa rota interna, não o TMDB diretamente —
  mesmo padrão de "segredos só no servidor" das tarefas de
  Architecture/Database anteriores, mesmo TASK-004 não pedindo isso
  explicitamente.
- **`/search/multi` do TMDB mistura filme/série/pessoa** — o client
  filtra `person` fora e normaliza o resto num formato único
  (`MediaSearchResult`, agora em `@seenlist/types`), o que já entrega
  os resultados "misturados" como pedido, sem lógica extra de
  ordenação.
- **Debounce**: `useDebouncedValue` em `@seenlist/hooks` (genérico,
  não amarrado à busca) — `SearchBar` usa com 400ms e só notifica o
  pai quando o valor já debounced muda.
- **Cache**: TanStack Query, `staleTime`/`gcTime` de 5 minutos em
  `useSearchMedia`. Provider (`app/providers.tsx`) entrou no layout
  raiz — não existia antes desta tarefa.
- **Navegação de detalhe**: `MediaCard` linka para `/movie/[id]` ou
  `/series/[id]`, exatamente como o documento pediu — essas rotas
  ainda não existem (dão 404), o que é esperado ("não implementar
  detalhes ainda").
- **Inconsistência de nomes que não corrigi sozinho**: a aba de
  filmes (TASK-003) é `/movies` (plural), mas este documento pede
  navegação de detalhe para `/movie/[id]` (singular). Implementei
  literalmente como pedido aqui, mas fica sinalizado — quando a
  página de detalhe for construída, vale decidir se os dois devem
  usar o mesmo padrão.

## Página da série (TASK-005)

- **Primeira tabela criada desde o reset do TASK-001**:
  `watched_episodes` (migration
  `supabase/migrations/20260705000000_watched_episodes.sql`). Toda
  tarefa anterior (002/003/004) tinha "não criar banco de dados"
  explícito — esta não tem, e pede literalmente "salvar no Supabase"
  ao marcar um episódio como assistido. Entendi a ausência da
  restrição como autorização implícita, mas só criei o mínimo
  necessário (uma tabela, não o schema arquivado de 12 tabelas de
  antes do reset).
- **Uma chamada só ao TMDB por carregamento de página**: a rota
  `/api/tmdb/series/[id]` orquestra `/tv/{id}` (com
  `append_to_response=credits,similar`) + uma chamada por temporada
  (em paralelo, via `Promise.all`) e devolve tudo já composto — o
  client faz um único `fetch`.
- **Episódios são buscados ao abrir a página** (não sob demanda ao
  expandir), porque o documento pede isso explicitamente em
  "CARREGAMENTO". Expandir uma temporada é só um toggle visual, sem
  fetch novo.
- **"Marcar assistido" é otimista**: o clique atualiza o cache do
  React Query na hora (`onMutate`) e só confirma com o Supabase depois
  — é o que faz "atualizar imediatamente a interface" acontecer de
  verdade, com rollback automático se a escrita falhar.
- **Rota**: `app/(main)/series/[id]/page.tsx` — fica dentro do grupo
  `(main)` (mesmo chrome de bottom nav/topo das outras abas). Uma
  página de detalhe sem esse chrome exigiria reestruturar os grupos de
  rota; mantive a opção mais simples e segura dado o risco de conflito
  de rotas.
- **Sem tipo `Database` gerado do Supabase** — as queries em
  `lib/queries/watched-episodes.ts` usam `.from("watched_episodes")`
  sem tipagem forte de coluna (mesma limitação já registrada em
  tarefas anteriores). Sugestão pra próxima fase: gerar o tipo via
  Supabase CLI.
- **Checks do projeto**: este sandbox não tem acesso à rede
  (`npm`/`pnpm install` falham), então não rodei `tsc`/`eslint` de
  verdade — fiz revisão manual completa de importações, tipos e
  chaves de JSX/parênteses em todos os arquivos novos. Rode
  `pnpm install && pnpm typecheck && pnpm lint` localmente antes de
  confiar cegamente nisso.

## Página do filme (TASK-006)

- **Rota real definida como `/movies/[id]`** (plural) — isso resolve a
  inconsistência sinalizada no TASK-004 (o `MediaCard` linkava pra
  `/movie/[id]`, singular). Corrigido para `/movies/${id}`.
- **Segunda tabela de dados de usuário**: `movie_status` (migration
  `20260706000000_movie_status.sql`) — um status só por filme
  (`watched` / `want_to_watch` / `watching`), não uma tabela por
  botão. Clicar no status já ativo limpa (mesmo padrão de toggle do
  botão de episódio assistido, TASK-005); clicar num status diferente
  substitui o anterior.
- **Uma chamada só ao TMDB**: diferente da série (que precisa de N+1
  chamadas por causa dos episódios por temporada), filme resolve tudo
  num `/movie/{id}` só, com `append_to_response=credits,similar,watch/providers`.
- **Reuso em vez de duplicação**: `CastCarousel` (já existia do
  TASK-005) mudou de `components/series/` pra `components/media/` —
  agora é literalmente o mesmo componente para série e filme, sem
  variante. `SimilarSeriesCarousel` e `SimilarMoviesCarousel` viraram
  reexports finos de um `SimilarTitlesCarousel` genérico único (o
  destino do link já vem do `mediaType` de cada item). Um `MetaRow`
  duplicado identicamente entre a aba "Sobre" da série e o "MovieInfo"
  do filme também foi extraído para `components/media/MetaRow.tsx`.
- **"Onde assistir"**: uso a região `BR` fixa (o produto é pt-BR de
  ponta a ponta) e só a lista `flatrate` (streaming por assinatura) —
  o documento não pede aluguel/compra, e o exemplo dado (Netflix,
  Prime Video, Disney+, Max, Apple TV) é todo de assinatura.
- **Botão voltar**: o documento desta tarefa não lista isso no HEADER
  (diferente da série, que listava explicitamente), mas incluí mesmo
  assim por consistência de navegação — é chrome, não uma feature.
- **Checks do projeto**: mesma limitação da tarefa anterior — sem
  rede neste sandbox para `pnpm install`/`tsc`/`eslint` de verdade.
  Revisão manual completa de importações, tipos e chaves em todos os
  arquivos novos; rode os checks reais localmente antes do deploy.
- **Nota sobre as instruções finais desta tarefa**: vieram duplicadas
  com mensagens de commit diferentes (`feat(movie): ...` no primeiro
  bloco, `feat(series): ...`, da tarefa anterior, num segundo bloco
  colado por cima). Usei `feat(movie): implement movie details page`,
  por ser a que corresponde ao que foi de fato construído aqui.

## Biblioteca / Minha Lista (TASK-007)

- **Estado 100% do Supabase, TMDB só decora.** `lib/queries/library.ts`
  decide o que está em cada aba olhando só `movie_status`,
  `series_status` e `watched_episodes`; o TMDB entra depois, numa
  chamada em lote (`/api/tmdb/library-summaries`), só pra
  poster/título/ano/total de episódios. Se essa chamada falhar, a
  Biblioteca ainda mostra os itens (sem poster/título bonito) — nunca
  trava por causa do TMDB.
- **Gap real que fica registrado**: a Página da Série (TASK-005) só
  tem o toggle de episódio assistido — nunca existiu um "status" de
  série (assistindo/quero assistir/concluído), e esta tarefa proíbe
  alterar aquela página. Resolvido com uma tabela nova,
  `series_status`, **opcional**: se não existir linha lá, o status é
  **derivado** de `watched_episodes` (tem episódio assistido e não
  completou = Assistindo; completou = Concluído). "Quero assistir"
  para uma série sem nenhum episódio assistido só existe se algo
  escrever explicitamente em `series_status` — hoje nada faz isso
  (não há botão em lugar nenhum pra isso), então essa combinação fica
  vazia até uma tarefa futura abrir esse caminho na página da série.
- **"Remover da lista" para série não apaga histórico.** Como o
  status pode ser derivado de episódios assistidos, remover grava
  `series_status = 'removed'` (um 4º valor só usado pra isso) em vez
  de apagar `watched_episodes` — que não é desta tarefa pra mexer.
- **Realtime de verdade**: as 3 tabelas entraram na publicação
  `supabase_realtime` (migration `20260707000002`) e
  `useLibraryRealtimeSync` assina mudanças via
  `postgres_changes`, invalidando a query da Biblioteca quando
  qualquer uma muda — cobre TASK-006 gerando uma mudança de
  `movie_status` do lado do filme e a Biblioteca refletindo sem
  precisar recarregar a página.
- **Bottom Navigation trocou Explorar por Minha Lista**, exatamente
  como pedido. Só `lib/navigation.ts` (config da barra) mudou — a
  Pesquisa em si (`/explore`, `SearchBar`, `SearchResults`, etc.)
  continua intocada, só perdeu o atalho na navegação. Ela ainda
  funciona se alguém for direto pra `/explore`.
- **Reuso**: `ProgressBar` virou um componente próprio
  (`components/media/ProgressBar.tsx`) usado pela `LibrarySeriesCard`
  — cheguei a refatorar o `ProgressCard` da série pra reusá-lo
  também, mas revertive porque isso tocaria um arquivo de
  `components/series/`, que esta tarefa proíbe alterar mesmo sendo
  uma mudança sem efeito visual. Preferi duplicar uma barra de 6
  linhas a arriscar violar a restrição.
- **`created_at` novo em `movie_status`** (migration `20260707000000`,
  aditiva) — necessário pra "Data adicionada" ser diferente de
  "Atualizados recentemente" na ordenação. Não muda nada que a
  Página do Filme já escreve.
- **Confirmado por `git status`**: nenhum arquivo de
  `components/series/`, `components/movie/`, `components/auth/`,
  `app/(auth)/`, `app/(main)/series/`, `app/(main)/movies/`,
  `app/(main)/profile/`, `middleware.ts` ou `lib/actions/auth.ts` foi
  tocado nesta tarefa.
- **Checks**: mesma limitação de rede das duas tarefas anteriores —
  revisão manual completa (JSON, chaves, imports, generics explícitos
  nas mutations) em vez de `tsc`/`eslint` de verdade.

## Estabilização (TASK-007A)

Revisão de manutenção em toda a base, sem funcionalidade nova. Relatório
completo em `docs/review/STABILIZATION_REPORT.md`. Resumo: extraído
`useOptimisticMutation` (4 mutations reimplementavam o mesmo padrão
otimista), `lib/env.ts` finalmente ligado nos 3 clientes Supabase + TMDB
(antes cada um validava `process.env` do seu jeito), `watched-episodes.ts`
e `movie-status.ts` divididos em leitura/escrita (mesmo padrão que
`library.ts` já tinha), e duas duplicações reais de tipo/constante
removidas. Nenhum arquivo de tela ou componente visual foi alterado.

## O que não está aqui (de propósito)

Login, pesquisa, banco de dados, API, navegação, qualquer tela de
produto. Ver `docs/README.md` para onde encontrar o trabalho anterior
arquivado.
