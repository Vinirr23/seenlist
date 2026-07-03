# MVP_REVIEW — TASK-010

Revisão como Staff Engineer: bugs, duplicação, arquitetura,
responsividade, UX, performance, acessibilidade e segurança em toda a
aplicação. Nenhuma funcionalidade nova foi adicionada.

---

## 1. Resumo geral

O SeenList hoje cobre um fluxo coerente de ponta a ponta: cadastro/
login (e-mail e Google) → pesquisa no TMDB → página de série ou filme
com dados reais → marcar como assistido/quero assistir/assistindo →
Biblioteca e Perfil refletindo isso automaticamente, sem reload, via
Supabase Realtime + comportamento padrão do React Query. A arquitetura
é consistente (client TMDB único, client Supabase único por contexto,
tipos compartilhados, hook de mutation otimista reutilizado, RLS em
toda tabela).

Esta revisão encontrou e corrigiu **7 bugs reais** (3 deles de
segurança — ver seção 3), confirmou que a base de acessibilidade e
performance já estava em bom estado (poucos ajustes necessários), e
identificou uma lacuna estrutural relevante para o MVP: **não existe
tela de Estatísticas** e o app mobile continua sendo só o placeholder
do TASK-001 — nenhum dos dois foi construído nesta tarefa, porque
"não criar novas funcionalidades" era uma restrição explícita.

## 2. Arquivos alterados

**Segurança:**
- `supabase/migrations/20260710000000_fix_update_policies_with_check.sql`
  (nova)
- `apps/web/lib/supabase/middleware.ts`
- `apps/web/app/api/tmdb/library-summaries/route.ts`
- `apps/web/app/api/search/route.ts`
- `apps/web/app/auth/callback/route.ts`

**Bug funcional (redirectTo nunca era usado):**
- `apps/web/lib/actions/auth.ts`
- `apps/web/app/(auth)/login/page.tsx`
- `apps/web/components/auth/GoogleButton.tsx`

Nenhum arquivo de `components/series/` ou `components/movie/` (além
do já citado) foi tocado — a revisão de UX/acessibilidade não achou
nada que precisasse de mudança nesses dois.

## 3. Bugs encontrados

### Segurança

1. **RLS de UPDATE sem `WITH CHECK`** (`movie_status`, `series_status`)
   — as policies de update só tinham `USING` (valida a linha antes),
   faltava `WITH CHECK` (valida a linha depois). Sem isso, nada no
   banco impedia uma requisição direta à API do Supabase de tentar
   reatribuir uma linha pra outro `user_id`. O app nunca fez isso pela
   UI, mas RLS não pode depender de "o app não deixa". **Corrigido**
   via `ALTER POLICY ... WITH CHECK (...)`.

2. **Rotas de API redirecionavam pra HTML em vez de devolver 401**
   — o middleware tratava `/api/*` igual a qualquer rota privada:
   sem sessão, mandava um redirect 302 pra `/login`. Isso é inofensivo
   numa navegação normal, mas se a sessão expira com a página já
   aberta, o `fetch()` do client segue o redirect automaticamente e
   recebe o **HTML da tela de login** como se fosse a resposta da API
   — o `.json()` de quem chamou quebra de um jeito confuso, sem
   mensagem de erro decente. **Corrigido**: `/api/*` agora devolve
   `401 { error: "Não autenticado." }` em vez de redirecionar.

3. **`redirectTo`/`next` sem validação (risco de open-redirect)** —
   tanto o valor que o middleware bota na URL de login quanto o `next`
   do callback de auth eram usados sem checar se apontavam pra dentro
   do próprio site. Na prática o jeito como o código concatenava as
   strings já evitava o pior caso, mas depender disso "por acidente"
   é frágil — qualquer refatoração futura (ex.: trocar pra
   `new URL(next, origin)`) reabriria a brecha sem ninguém perceber.
   **Corrigido**: os dois só aceitam caminhos internos (`/algo`,
   nunca `//algo` ou uma URL absoluta).

### Funcional

4. **Login nunca respeitava pra onde o usuário estava tentando ir.**
   O middleware guarda isso em `?redirectTo=`, mas nada lia esse
   parâmetro — todo login (e-mail ou Google) caía direto em `/series`,
   mesmo vindo de um link direto pra `/movies/123`. **Corrigido**: o
   valor agora viaja como campo oculto nos dois formulários (e-mail e
   Google) e o login volta pra onde o usuário queria ir.

5. **Erro de Google/link expirado desaparecia sem aviso.** Falhas
   nesses dois fluxos já redirecionavam pra `/login?error=...`, mas a
   página nunca lia isso — o erro era descartado silenciosamente.
   **Corrigido na TASK-009**, confirmado nesta revisão que continua
   funcionando após as mudanças de `redirectTo`.

### Robustez

6. **`/api/tmdb/library-summaries` sem validação de entrada e sem
   tratar erro de parse do JSON.** `request.json()` podia lançar antes
   mesmo de entrar no `try`, virando um 500 genérico do Next em vez da
   mensagem amigável que a rota tenta dar. Também não validava que
   `movieIds`/`seriesIds` eram de fato arrays de números — um corpo
   malformado passaria adiante e faria a rota tentar buscar IDs
   inválidos no TMDB, ou (se muito grande) disparar centenas de
   requisições paralelas. **Corrigido**: parse com try/catch próprio,
   filtro que só aceita inteiros positivos, limite de 100 ids por
   requisição.

### Qualidade de código (não é bug funcional, mas induzia a erro)

7. **Comentário desatualizado no middleware** dizia "hoje só existe
   '/'", o que não é mais verdade desde o TASK-003 — corrigido pra
   descrever a regra real (tudo é privado por padrão).

## 4. Melhorias realizadas

Além das correções de bug acima, nenhuma melhoria "extra" foi feita
nesta tarefa — Fase 1 do documento pede explicitamente para não mudar
comportamento sem necessidade, e a maior parte do trabalho de
dedup/arquitetura já tinha sido feito no TASK-007A (estabilização) e
no TASK-009 (conexão do fluxo). Esta revisão confirmou que aquele
trabalho continua válido:

- Client TMDB único, client Supabase único por contexto — confirmado,
  sem regressão.
- `useOptimisticMutation` e `useRealtimeInvalidate` — únicos pontos de
  mutation otimista e assinatura Realtime, nenhuma duplicação nova
  encontrada.
- Nenhum `invalidateQueries()` genérico (sem `queryKey`) em lugar
  nenhum — toda invalidação já é específica.
- Todo `<Image>` do projeto tem `alt` (vazio só nos backdrops
  decorativos, com texto real em todo o resto).
- Todo botão só-com-ícone já tinha `aria-label` antes desta tarefa
  (verificado, não precisou de correção).
- Nenhum `key` faltando em `.map()` — conferido em todos os 15
  arquivos que renderizam listas.
- Nenhum `any` explícito em todo o código TypeScript do projeto.

## 5. Dívida técnica restante

- **Sem tipo `Database` gerado do Supabase** — queries usam
  `.from("tabela")` sem tipagem forte de coluna (registrado desde
  TASK-005).
- **`series_status = 'want_to_watch'` inalcançável** — não há tela
  que escreva esse status para uma série sem episódio assistido
  (registrado desde TASK-007).
- **App mobile é só o placeholder do TASK-001** — nenhuma tarefa
  desde então tocou em `apps/mobile`. Login, busca, séries, filmes,
  biblioteca e perfil só existem no web.
- **Sem testes automatizados** — toda verificação desde o TASK-005 é
  revisão manual de código (balanceamento de sintaxe, rastreamento de
  imports); nunca houve confirmação real de que o app compila e roda.
- **Sem layout adaptativo pra desktop/tablet** — ver seção de
  responsividade abaixo.
- **Estado de erro/pending por mutation é compartilhado entre itens**
  em `SeasonAccordion` (um `useToggleEpisodeWatched` só por temporada,
  não por episódio) — clicar em dois episódios rápido mostra o mesmo
  estado de loading/erro pros dois. Registrado desde o TASK-009, não é
  regressão desta tarefa.

## 6. Nota do projeto: 7/10

**Por que não é mais alto**: nunca foi possível confirmar
`build`/`typecheck`/`lint` de verdade (sandbox sem rede desde o
TASK-005) — a nota não pode assumir "compila sem erros" como fato, só
como "revisão manual não achou nada que impedisse". Faltam testes
automatizados inteiramente. O app mobile não existe além de um
placeholder. Não há tela de Estatísticas, que o próprio fluxo do
produto (TASK-009) já esperava existir.

**Por que não é mais baixo**: a arquitetura é limpa e consistente,
RLS cobre 100% das tabelas (incluindo o bug de `WITH CHECK` que esta
revisão fechou), o fluxo principal (login → busca → série/filme →
biblioteca → perfil) está genuinamente conectado e reativo em tempo
real, acessibilidade básica (aria-labels, alt text, foco nativo) já
estava em bom estado antes mesmo desta revisão, e os bugs de
segurança encontrados eram de baixo risco prático (exigiam contornar a
UI para explorar) mas foram corrigidos mesmo assim.

## 7. O que falta para publicar o MVP

Em ordem de prioridade:

1. **Rodar `pnpm install && pnpm lint && pnpm typecheck && pnpm build`
   de verdade**, num ambiente com rede — esta é a lacuna mais
   importante entre "revisão de código" e "pronto pra produção".
   Nenhuma tarefa desde o TASK-005 conseguiu confirmar isso.
2. **Configurar o projeto Supabase de verdade**: rodar as migrations,
   habilitar o provider Google, configurar as Redirect URLs
   (documentado desde o TASK-002).
3. **Decidir sobre Estatísticas** — construir a tela (fora do escopo
   desta tarefa) ou remover a expectativa dela do fluxo de produto.
4. **Gerar o tipo `Database`** do Supabase CLI — destrava segurança de
   tipo em todas as queries.
5. **Testes automatizados**, pelo menos para os fluxos críticos
   (login, marcar assistido, RLS).
6. Decidir se o app mobile entra no MVP ou fica para depois — hoje é
   só um placeholder.
7. Layout adaptativo pra desktop/tablet, se o público-alvo do
   lançamento incluir esses formatos (hoje funciona sem quebrar, mas
   não aproveita a tela maior).
