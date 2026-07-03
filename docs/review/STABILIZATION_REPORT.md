# STABILIZATION_REPORT — TASK-007A

Revisão de manutenção/arquitetura em todo o projeto, sem novas
funcionalidades, sem mudança de comportamento ou de design. Este
relatório cobre os 20 itens de VERIFICAR do documento, na ordem.

---

## Contexto — estado encontrado no início da tarefa

Antes de eu tocar em qualquer coisa, o repositório já estava com
`lib/queries/library.ts` dividido em `library-state.ts` (leitura) +
`library-mutations.ts` (escrita) + um barrel, e um novo
`apps/web/lib/env.ts` (validação de env) tinha sido criado, mas
**nunca importado em lugar nenhum**. Tratei isso como o ponto de
partida real da tarefa: completar essa divisão (aplicando o mesmo
padrão nos outros arquivos que tinham o mesmo problema) e efetivamente
ligar o `env.ts` que já existia, mas estava órfão.

---

## 1. Código duplicado — extraído

- **Padrão de mutation otimista repetido 4 vezes** (episódio
  assistido, status de filme, mover/remover da biblioteca — todos
  reimplementavam `cancelQueries` → `getQueryData` → `setQueryData`
  → rollback no erro → `invalidateQueries`). Extraído para
  `packages/hooks/src/useOptimisticMutation.ts` e usado nos 4 lugares.
  Comportamento (o que cada mutation faz, quando desfaz) não mudou —
  só a boilerplate em volta.
- **`process.env.NEXT_PUBLIC_SUPABASE_URL!` / `_ANON_KEY!` repetidos
  em 3 arquivos** (`lib/supabase/client.ts`, `server.ts`,
  `middleware.ts`) e a validação do `TMDB_API_KEY` reimplementada
  dentro de `lib/tmdb/client.ts`. Todos os quatro agora passam por
  `apps/web/lib/env.ts` (que já existia, mas não estava ligado a
  nada).
- **`MediaSummary` duplicado com nomes iguais e formas ligeiramente
  diferentes** — um em `lib/tmdb/client.ts` (com `id`), outro
  redeclarado do zero em `lib/queries/library-state.ts` (sem `id`).
  `library-state.ts` agora importa o tipo real em vez de redeclarar.
- **`TYPE_LABEL` (Filme/Série) duplicado identicamente** em
  `MediaCard.tsx` (busca) e `LibraryCard.tsx` (biblioteca). Extraído
  para `apps/web/lib/media-labels.ts`.
- **Cor duplicada** entre `packages/config/src/tailwind-tokens.ts`
  (fonte única, conforme o próprio comentário do arquivo) e
  `apps/mobile/app/index.tsx`, que tinha os mesmos hex hardcoded em
  vez de importar de `@seenlist/config`. Corrigido — mesmo resultado
  visual, sem duplicar o valor.

## 2. Componentes/arquivos muito grandes — separados onde fazia sentido

Segui o padrão que já existia em `library.ts` e apliquei nos dois
arquivos com o mesmo problema (leitura e escrita misturadas num
hook só): `watched-episodes.ts` → `watched-episodes-state.ts` +
`watched-episodes-mutations.ts`; `movie-status.ts` →
`movie-status-state.ts` + `movie-status-mutations.ts`. Os arquivos
originais viraram barrels (`export * from "./..."`), então **nenhum
componente consumidor precisou mudar o import** — verifiquei isso
explicitamente (`SeasonAccordion`, `SeriesDetailsView`,
`MovieActions`, `MovieDetailsView`, `LibraryCard`, `LibraryView`
continuam importando dos mesmos caminhos de sempre).

`lib/tmdb/client.ts` (335 linhas) foi avaliado e **não foi dividido**.
É um único domínio coeso (só fala com o TMDB), já organizado em seções
comentadas por feature (busca, série, filme, resumos da biblioteca).
Dividir isso sem um compilador real pra verificar cada import
(ver seção de limitações) tinha risco de introduzir um erro bobo
para um ganho de organização discutível — registrado como sugestão
pra próxima tarefa, não feito agora.

## 3–4. Imports desnecessários / arquivos não utilizados

Rodei uma varredura heurística (script Python, sem `tsc`/ESLint reais
disponíveis — ver limitações) em todos os arquivos de `apps/web` e
`packages/*`: nenhum import genuinamente não utilizado encontrado nos
arquivos verificados manualmente com mais atenção (os maiores e mais
centrais). Nenhum arquivo totalmente órfão encontrado — todo arquivo é
referenciado por pelo menos um outro.

Exceção conhecida, mantida de propósito: `Poster`, `Avatar` e `Modal`
em `packages/ui` não são usados em nenhuma tela ainda. Não são código
morto acidental — são a "estrutura preparada para futuras
funcionalidades" que o próprio TASK-001 pediu explicitamente. Não
removi.

## 5–6. Warnings de TypeScript / ESLint

Não consegui rodar `tsc`/`eslint` de verdade neste sandbox (sem acesso
à rede pra `pnpm install` — mesma limitação já registrada nos
relatórios das tarefas 005/006/007). Fiz revisão manual de todo
arquivo tocado (chaves/parênteses balanceados, imports rastreados um
a um, generics explícitos nas mutations). Ver "Ao final" mais abaixo.

## 7. Organização de pastas

Estrutura por domínio (`components/{auth,layout,library,media,movie,
search,series}`, `lib/{actions,queries,supabase,tmdb}`) já está
consistente e não precisou mudar. `lib/queries/` cresceu para 11
arquivos com o padrão state/mutations — ainda legível pelo prefixo do
nome, mas se crescer mais, virar subpastas por domínio
(`lib/queries/library/`, `lib/queries/movie/` etc.) é o próximo passo
natural — não fiz agora pra não arriscar quebrar os barrels sem
como testar.

## 8. Hooks repetidos — unificados

Ver item 1 (`useOptimisticMutation`). Não havia outros hooks
genuinamente repetidos além desse padrão.

## 9. TMDB — client único

Confirmado: `themoviedb.org`/`image.tmdb.org` só aparecem em
`lib/tmdb/client.ts` e `lib/tmdb/image.ts` — nenhum outro arquivo
chama o TMDB direto.

## 10. Supabase — client único

Confirmado: `createBrowserClient`/`createServerClient` só existem em
`lib/supabase/client.ts`, `server.ts` e `middleware.ts` (as três
variantes exigidas pelo padrão SSR do Next — não é duplicação, são
contextos diferentes). Os outros 10 arquivos que precisam do Supabase
importam `createClient` de um desses três, nenhum instancia por
conta própria.

## 11. Variáveis de ambiente — validadas

`apps/web/lib/env.ts` (já existia, órfão) agora é a única porta de
entrada pra `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
e `TMDB_API_KEY` — falha cedo com mensagem dizendo qual variável está
faltando, em vez de um erro genérico de dentro do `@supabase/ssr` lá
na frente. `NEXT_PUBLIC_SITE_URL`/`VERCEL_URL` (em
`lib/actions/auth.ts`) ficaram de fora de propósito: são opcionais
com fallback por design, não "obrigatórias" — não é o mesmo tipo de
validação.

## 12. Tipos centralizados

Ver item 1 (`MediaSummary`). Revisei todas as `interface`/`type`
declaradas fora de `packages/types` — o resto são formas legitimamente
locais (linhas de resposta do Supabase/TMDB específicas de uma
query, variáveis de mutation, tipos de UI como `LibrarySort`) que não
fazem sentido centralizar (não são domínio compartilhado entre
web/mobile, são detalhe de implementação de um arquivo só).

## 13. Performance

`useMemo` já existia só onde fazia sentido (`LibraryView`, filtro +
ordenação da lista) com dependências corretas. Não adicionei
`useCallback` em lugar nenhum: nenhum componente do projeto usa
`React.memo`, então memoizar callbacks não teria efeito real sem essa
camada — adicionar teria sido otimização sem ganho mensurável
("não exagerar", conforme pedido). Nenhuma renderização
desnecessária óbvia encontrada.

## 14. Responsividade

Nenhuma largura fixa em pixels fora de `sizes` de `next/image`
encontrada — todo o layout usa a escala do Tailwind
(`max-w-2xl`, `w-full`, `flex-1` etc.), consistente com mobile-first
desde o TASK-001. Nenhuma regressão identificada.

## 15. Tema — consistência de cores

Nenhuma cor hex fora do sistema de tokens em componentes web (as
únicas encontradas são as cores de marca do ícone do Google, que têm
que ser exatas, não fazem parte do tema). A duplicação no mobile foi
corrigida (ver item 1). Nenhuma aparência mudou.

## 16. Código morto

Nada removido além do que já virou barrel (e os barrels continuam
reexportando tudo, então não é remoção de fato, é indireção). Ver
item 3–4 sobre os componentes de UI intencionalmente não usados
ainda.

## 17. Memory leaks

Revisei os dois únicos `useEffect` do projeto:
`SearchBar` (sem timers/subscriptions, sem risco) e a assinatura
Realtime em `useLibraryRealtimeSync` (`library-state.ts`) — já tinha
cleanup correto (`cancelled` flag + `removeChannel` no unmount) desde
que foi escrita no TASK-007, confirmado que continua correto depois
da divisão de arquivo. `useDebouncedValue` limpa o `setTimeout`
corretamente. Nada encontrado pra corrigir aqui.

## 18. Erros silenciosos

Encontrados e corrigidos: **4 route handlers**
(`/api/search`, `/api/tmdb/series/[id]`, `/api/tmdb/movie/[id]`,
`/api/tmdb/library-summaries`) tinham `catch {}` sem nenhum log —
se o TMDB falhasse, a única pista era um 502 genérico, sem saber por
quê. Adicionado `console.error` com contexto antes de cada resposta
de erro — **a resposta que o client recebe não mudou em nada**, só
ficou visível no log do servidor. Mesma correção em
`app/auth/callback/route.ts`, que descartava o erro do Supabase ao
trocar o código por sessão. As Server Actions de auth
(`lib/actions/auth.ts`) não tinham esse problema — elas já traduzem o
erro pra uma mensagem visível na tela, não é um caso silencioso.

## 19. Mensagens de erro — padronizadas

Já estavam consistentes ("Não foi possível [ação] agora." +, quando
faz sentido, "Tente de novo em instantes.") — conferido em todos os
9 lugares que têm mensagem de erro voltada pro usuário. Não precisou
mudar nenhuma.

## 20. Legibilidade

Coberta pelas mudanças acima (nomes de arquivo mais previsíveis com o
padrão `-state`/`-mutations`, tipos não duplicados com nomes
colidindo, constantes compartilhadas em vez de repetidas).

---

## Arquivos alterados nesta tarefa

**Novos:**
`packages/hooks/src/useOptimisticMutation.ts`,
`apps/web/lib/media-labels.ts`,
`apps/web/lib/queries/{watched-episodes,movie-status}-{state,mutations}.ts`,
`docs/review/STABILIZATION_REPORT.md`

**Modificados:**
`apps/web/lib/supabase/{client,server,middleware}.ts`,
`apps/web/lib/tmdb/client.ts`,
`apps/web/lib/queries/{library,watched-episodes,movie-status}.ts`
(viraram barrels),
`apps/web/lib/queries/library-mutations.ts` (usa o hook compartilhado),
`apps/web/app/api/{search,tmdb/series/[id],tmdb/movie/[id],tmdb/library-summaries}/route.ts`
(log de erro),
`apps/web/app/auth/callback/route.ts` (log de erro),
`apps/web/components/{search/MediaCard,library/LibraryCard}.tsx`
(constante compartilhada),
`apps/mobile/app/index.tsx` (cor via token em vez de hex),
`packages/hooks/package.json` (nova dependência: `@tanstack/react-query`)

**Nada em `components/series/`, `components/movie/` (visual),
`components/auth/` (visual), telas novas, ou qualquer lógica de
negócio foi tocado** — só a camada de dados, infraestrutura de env e
2 constantes duplicadas.

---

## Problemas encontrados, não corrigidos (ficam para decisão futura)

- `lib/tmdb/client.ts` com 335 linhas — candidato a dividir por
  domínio (busca/série/filme/biblioteca) se crescer mais.
- `lib/queries/` com 11 arquivos num diretório só — considerar
  subpastas por domínio quando/se crescer mais.
- `Poster`, `Avatar`, `Modal` de `packages/ui` seguem sem uso — não é
  problema desta tarefa, mas quando perfil/conquistas forem
  implementados, são os primeiros candidatos a finalmente ganhar
  consumidor.
- Nenhuma mutation exibe o próprio erro na UI hoje (o estado de erro
  existe no React Query, mas nenhum componente lê `mutation.error`
  pra mostrar algo) — funciona (o rollback otimista já desfaz a
  mudança visualmente), mas o usuário não recebe uma mensagem
  explicando por que falhou. Não mexi por ser mudança de
  comportamento/UI, fora do escopo desta tarefa.

## Dívida técnica restante

- Sem tipo `Database` gerado do Supabase (`.from("...")` sem
  tipagem forte de coluna) — já registrado nos relatórios de
  TASK-005/006, continua valendo.
- `series_status` com status `'want_to_watch'` só é alcançável via
  ação manual na Biblioteca — não há entrada na própria página da
  série ainda (já registrado no relatório do TASK-007).
- Sem suíte de testes automatizados — toda a verificação desta tarefa
  foi manual, por não haver `tsc`/`eslint`/build reais disponíveis
  neste ambiente.

## Sugestões para próximas tarefas

- Gerar o tipo `Database` do Supabase assim que o CLI puder rodar com
  rede — destrava tipagem forte em todas as queries.
- Se/quando `packages/ui`'s `Poster` for finalmente usado, considerar
  migrar `MediaCard`/`LibraryCard`/os carousels pra ele em vez de
  `next/image` cru repetido em cada um.
- Rodar `pnpm install && pnpm typecheck && pnpm lint && pnpm build`
  de verdade assim que possível — esta tarefa não pôde confirmar isso
  automaticamente (ver limitações abaixo).

---

## Ao final — limitação importante

O critério de aceitação pede para rodar lint, typecheck e build e
confirmar que passam. **Este sandbox não tem acesso à rede** (mesma
limitação já registrada em todos os relatórios desde o TASK-005), o
que impede `pnpm install` e, por consequência, qualquer um dos três
comandos reais. Como alternativa, fiz:

- Validação de sintaxe JSON em 100% dos arquivos `.json` do repo.
- Checagem de balanceamento de chaves/parênteses em 100% dos arquivos
  `.ts`/`.tsx` de `apps/` e `packages/`.
- Rastreamento manual de cada import novo/alterado até sua origem.
- Generics explícitos nas mutations (`useMutation<...>`,
  `useOptimisticMutation<...>`) para reduzir dependência de inferência
  de tipo que eu não consigo confirmar sem compilador.

Isso reduz bastante o risco, mas **não substitui** rodar
`pnpm install && pnpm lint && pnpm typecheck && pnpm build` de
verdade antes de mesclar. Recomendo fortemente rodar isso localmente
antes de considerar esta tarefa 100% validada.
