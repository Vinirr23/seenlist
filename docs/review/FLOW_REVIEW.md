# FLOW_REVIEW — TASK-009: Conectar o Fluxo Principal

## Conflito que precisa de decisão — leia isto primeiro

O documento pede pra conectar um fluxo que passa por **Perfil** e
**Estatísticas** atualizando automaticamente, mas também diz
explicitamente "NÃO criar novas funcionalidades. Apenas conectar
tudo." Só que:

- **Estatísticas não existe.** Não há rota, não há aba, não há
  nenhum arquivo — nenhuma tarefa anterior criou isso. "Conectar"
  uma tela que não existe não é conectar, é criar. Não construí essa
  tela.
- **Perfil era um placeholder vazio** (só título + descrição,
  "estrutura preparada" desde o TASK-003). Diferente de
  Estatísticas, a rota/página já existia — então, adicionar os
  números que o próprio documento pede (filmes/séries/episódios
  assistidos) usando dados que outras tarefas já buscam é
  genuinamente "conectar dados existentes numa tela existente", não
  criar uma funcionalidade nova. Fiz isso.
- **O documento se contradiz sozinho**: a seção PERFIL pede pra
  atualizar automaticamente "Avaliações" e "Comentários", mas a
  seção NÃO IMPLEMENTAR do mesmo documento proíbe "Comentários" — e
  "Avaliações" nunca existiu como funcionalidade (proibido desde o
  TASK-006/007). Não implementei nenhum dos dois — não tem o que
  conectar, os dados não existem em lugar nenhum.

**Resumo da decisão**: conectei tudo que já existia e podia ser
conectado sem criar tela nova. Perfil ganhou 3 números reais (filmes
assistidos, séries concluídas, episódios assistidos), ao vivo, sem
reload. Estatísticas continua não existindo — construir essa tela
seria decisão de produto que este documento não me autoriza a tomar
sozinho, dado que ele mesmo proíbe "criar novas funcionalidades".

---

## O que foi conectado

### 1. Hook compartilhado de Realtime (evita duplicar a assinatura Supabase)

Antes desta tarefa, só a Biblioteca tinha sincronização em tempo real
(`useLibraryRealtimeSync`, com a assinatura Postgres Changes escrita
inline). Como o Perfil também precisa de "sem reload", extraí isso
para `apps/web/lib/supabase/useRealtimeInvalidate.ts` — um hook
genérico (tabelas + query key) que tanto a Biblioteca quanto o Perfil
usam agora. Mesmo comportamento de antes para a Biblioteca (mesmas 3
tabelas, mesma query key), só sem repetir a assinatura uma segunda
vez.

### 2. Perfil mostra números reais, ao vivo

`apps/web/lib/queries/user-stats.ts` — **zero chamadas novas ao
Supabase ou ao TMDB**: o hook `useUserStats` chama `useLibraryItems()`
(que a Biblioteca já usa) e só agrega o resultado. Isso automaticamente
significa:
- Estatísticas "calculadas automaticamente, sem tabela de cache"
  (exigência explícita do documento) — não existe nenhuma tabela nova,
  é tudo derivado em memória a cada render.
- Atualização em tempo real "de graça", reaproveitando o mesmo
  `useRealtimeInvalidate`.

### 3. "Ao concluir todos os episódios, mover automaticamente para Concluído" — corrigido um caso que faltava

Isso já funcionava para séries **sem** status explícito (o cálculo de
"completed" já existia desde o TASK-007, derivado de
`watched_episodes` vs. total de episódios do TMDB). Mas **não
funcionava** se o usuário tivesse definido um status manual pela
Biblioteca antes de terminar (ex.: marcou "Assistindo" na mão, depois
terminou todos os episódios pela Página da Série) — o status explícito
sempre vencia, então a série nunca virava "Concluído" sozinha nesse
caso. Corrigido em `lib/queries/library-state.ts`: completar todos os
episódios agora sempre vence, seja o status derivado ou explícito.

### 4. Feedback de erro amigável — 3 mutations não tinham nenhum

`EpisodeCard`/`SeasonAccordion` (marcar episódio), `MovieActions`
(status do filme) e `LibraryCard` (mover/remover) já desfaziam a
mudança visualmente se a escrita no Supabase falhasse (rollback
otimista, desde as tarefas 005–007), mas **nada avisava o usuário que
algo tinha dado errado** — o botão só voltava ao estado anterior, sem
explicação. Adicionado `apps/web/components/media/InlineError.tsx`
(uma linha de texto, reaproveitada nos 3 lugares) que aparece quando a
mutation falha.

### 5. Erro de login com Google/link expirado — estava sendo descartado

Achado durante a revisão do fluxo: `signInWithGoogle` e
`/auth/callback` já redirecionavam para `/login?error=google` ou
`/login?error=callback` em caso de falha, mas a página de login nunca
lia esse parâmetro — o erro literalmente desaparecia, o usuário só via
a tela de login de novo sem explicação nenhuma. Corrigido: a página
agora lê `?error=` e mostra uma mensagem amigável (usando o mesmo
componente `FormFeedback` que o login por e-mail já usa). Precisei
envolver essa parte em `<Suspense>` porque `useSearchParams` exige
isso no App Router.

### 6. Loading no botão do Google — não existia

`GoogleButton` era um `<form>` com um botão comum, sem nenhum estado
de "aguarde" enquanto a Server Action processa (diferente do
`SubmitButton` usado no login por e-mail, que já tinha isso desde o
TASK-002). Adicionado o mesmo padrão (`useFormStatus`), mantendo o
estilo próprio do botão do Google (não deu pra reaproveitar o
`SubmitButton` direto — as classes de cor dele são fixas e eu
sobrescrever via `className` teria um resultado imprevisível, já que
o `cn()` do projeto não faz merge/override de classes Tailwind
conflitantes, só concatena).

---

## O que já estava conectado (verificado, não alterado)

- **Login → Pesquisa → Página da Série/Filme**: navegação padrão do
  Next.js (`Link`/redirects), sem necessidade de nenhuma alteração.
- **Marcar episódio/filme assistido → Biblioteca atualiza**: já
  funcionava desde o TASK-007 por dois caminhos complementares — (a)
  Realtime nas 3 tabelas quando a Biblioteca já está aberta em outra
  aba/sessão, e (b) a query da Biblioteca não tem `staleTime`
  configurado, então toda vez que a página é visitada ela busca dados
  novos automaticamente (sem precisar de F5). Testado mentalmente os
  dois caminhos, ambos corretos.
- **Persistência no Supabase**: todas as mutations (`useToggleEpisodeWatched`,
  `useSetMovieStatus`, `useMoveLibraryItem`, `useRemoveLibraryItem`)
  já escrevem antes de confirmar o cache otimista (o rollback só
  acontece se a escrita real falhar) — não havia nenhum caso de "a
  tela mudou mas nada foi salvo".
- **Invalidação precisa do React Query**: conferido — todo
  `invalidateQueries` do projeto (só 2 lugares: `useOptimisticMutation`
  e `useRealtimeInvalidate`) já usa uma `queryKey` específica, nunca
  uma invalidação global. Nada para otimizar aqui.

---

## Testes (verificação manual — sem navegador neste sandbox)

Não há acesso a rede neste ambiente (não dá pra rodar a aplicação de
verdade nem abrir um browser). Verifiquei cada etapa do fluxo por
leitura de código, rastreando de ponta a ponta:

| Etapa | Verificado como |
|---|---|
| Login | Código inalterado desde TASK-002, exceto o novo aviso de erro de redirect |
| Pesquisa | Código inalterado desde TASK-004 |
| Página Série | `useToggleEpisodeWatched` → Supabase → Realtime/staleTime=0 → Biblioteca/Perfil |
| Página Filme | `useSetMovieStatus` → Supabase → Realtime/staleTime=0 → Biblioteca/Perfil |
| Biblioteca | `useLibraryItems` + `useLibraryRealtimeSync` (agora via hook compartilhado) |
| Perfil | `useUserStats` (novo) → mesma fonte de dados da Biblioteca |
| Atualização automática | Confirmado via Realtime (3 tabelas na publicação desde TASK-007) + comportamento padrão de `staleTime: 0` do React Query |

**Recomendo fortemente testar isso de verdade num ambiente com
Supabase configurado** antes de considerar o fluxo validado — revisão
de código não substitui ver o app rodando.

---

## Melhorias feitas (resumo)

1. `useRealtimeInvalidate` — hook compartilhado, elimina duplicação
   que aconteceria ao dar ao Perfil sua própria assinatura Realtime.
2. `useUserStats` — Perfil conectado com dados reais, zero chamadas
   novas.
3. Série completa sempre vira "Concluído", mesmo com status manual
   anterior.
4. Feedback de erro em 3 mutations que só desfaziam silenciosamente.
5. Erro de redirect do login (Google/callback) deixou de ser
   descartado.
6. Loading no botão do Google.

## Problemas encontrados, não corrigidos

- **Estatísticas não existe** — ver seção do conflito, no topo.
- Erro do Google OAuth sempre redireciona pra `/login`, mesmo se o
  clique foi na página de `/register` — o usuário perde o contexto de
  que estava se cadastrando. Pré-existente, não mexi (mudar isso
  significa decidir para onde `signInWithGoogle` deveria redirecionar
  com base em onde foi chamado — mudança de comportamento pequena mas
  real, fora do que "conectar" pede).
- `EpisodeCard`/`SeasonAccordion`: o estado de pending/erro da
  mutation é por temporada (um `useToggleEpisodeWatched` só, criado
  uma vez por `SeasonAccordion`), não por episódio individual — clicar
  em dois episódios rápido na mesma temporada mostra o mesmo estado de
  loading/erro pros dois. Já existia desde o TASK-005, não é
  regressão desta tarefa, mas vale registrar.

## Possíveis otimizações (não feitas)

- `useUserStats` recalcula os 3 totais a cada render em que
  `libraryQuery.data` muda — para uma biblioteca muito grande (centenas
  de itens) isso ainda é O(n) trivial, não é um problema real hoje,
  mas se um dia a Biblioteca crescer myito, computar os totais no
  próprio `fetchLibraryItems` (uma vez, no fetch) em vez de a cada
  consumidor que quiser um resumo evitaria recomputar o mesmo loop em
  mais de um lugar.
- Persistir os canais Realtime entre navegações (hoje cada
  Biblioteca/Perfil monta e desmonta sua própria assinatura) — só
  vale a pena se o custo de reconectar ao Supabase Realtime a cada
  troca de tela se mostrar um problema real de latência, o que não
  dá pra medir neste sandbox.

## Dívida técnica restante (herdada de tarefas anteriores)

- Sem tipo `Database` gerado do Supabase (já registrado desde
  TASK-005).
- `series_status = 'want_to_watch'` sem nenhuma tela que escreva isso
  (já registrado desde TASK-007) — o Perfil e a Biblioteca continuam
  não tendo como popular essa combinação especificamente pra séries
  ainda não iniciadas.
- Sem suíte de testes automatizados.

---

## Ao final — mesma limitação de rede das tarefas anteriores

Não há acesso à rede neste sandbox, então `pnpm install` (e por
consequência `lint`/`typecheck`/`build` reais) não puderam rodar. Fiz:

- Validação de sintaxe JSON em todos os `.json` do repo.
- Balanceamento de chaves/parênteses em todos os arquivos tocados.
- Rastreamento manual de cada import novo/alterado.
- Atenção especial ao padrão de `className` conflitante com `cn()`
  (já tinha causado um bug sutil numa tarefa anterior — evitei
  repetir isso no `GoogleButton`).

Recomendo fortemente rodar
`pnpm install && pnpm lint && pnpm typecheck && pnpm build` de
verdade antes de mesclar.
