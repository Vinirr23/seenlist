# FASE 1 — Edge Functions da migração mobile sem Vercel (2026-10-20)

Estas 4 functions diferem das 6 já existentes (`check-new-releases`,
`send-push-notifications`, `daily-status-recalc`, `week-review-pregenerate`,
`week-review-notify`, `enrich-media-countries`) num ponto importante:
são chamadas **direto pelo app mobile** (`supabase.functions.invoke`),
não só por `pg_cron`/`pg_net`. Por isso `verify_jwt = true` está
declarado explicitamente em `config.toml` pra cada uma — sem um JWT
válido (token de sessão, ou a anon key quando deslogado — o cliente
Supabase do mobile já manda isso automaticamente), o Supabase rejeita
a requisição antes de a function rodar.

## 1. Deploy

```bash
supabase functions deploy library-summaries
supabase functions deploy season-recap
supabase functions deploy series-data
supabase functions deploy tmdb-catalog
```

Todas importam de `supabase/functions/_shared/tmdb.ts`,
`_shared/tmdbSeries.ts` e/ou `_shared/tmdbCatalog.ts` (import
relativo) — o CLI empacota isso automaticamente no deploy de cada
uma, mesmo mecanismo já usado por `_shared/weekBounds.ts`.

## 2. Segredos novos

`TMDB_API_KEY` já deve estar configurado (usado por
`enrich-media-countries`, e agora também por `series-data` e
`tmdb-catalog`). A única variável NOVA que este grupo de functions
precisa:

```bash
supabase secrets set GEMINI_API_KEY=<a mesma chave já usada em apps/web>
```

(`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` continuam injetadas
automaticamente, como em toda Edge Function.)

Opcional, mesmo comportamento de `apps/web` (`lib/ai/providers/gemini.ts`):

```bash
supabase secrets set GEMINI_MODEL=<nome do modelo, se quiser sobrescrever o default>
```

## 3. O que cada uma substitui (rota Vercel → Edge Function)

| Edge Function | Rota Vercel original | Por que não pode ser chamada direta à TMDB do mobile |
|---|---|---|
| `library-summaries` | `apps/web/app/api/tmdb/library-summaries/route.ts` | Lê/escreve `media_summaries_cache` (sem RLS nenhuma — só chave de serviço) |
| `season-recap` | `apps/web/app/api/season-recap/[seriesId]/[season]/route.ts` | Chave da Gemini (segredo de verdade) + grava `season_recaps` (só chave de serviço) |
| `series-data` (`"details"`) | `apps/web/app/api/tmdb/series/[id]/route.ts` | `getSeasonEpisodes` grava em `series_season_episode_counts` (emblema "Temporada Concluída", só chave de serviço) |
| `series-data` (`"episode-context"`) | `.../series/[id]/season/[season]/episode-context/route.ts` | Mesmo motivo — usa a mesma `getSeasonEpisodes` |
| `series-data` (`"episode"`) | `.../episode/[seriesId]/[season]/[episode]/route.ts` | SEM efeito colateral no Supabase — entrou aqui por decisão explícita do usuário (2026-10-20), pra não expor `TMDB_API_KEY` no bundle do app |
| `series-data` (`"episodes-at-export"`) | `apps/web/app/api/tmdb/series-episodes-at-export/route.ts` | `getAllEpisodesWithAirDates` usa a mesma `getSeasonEpisodes` de "details"/"episode-context" — mesmo efeito colateral |
| `tmdb-catalog` (`"search"`) | `apps/web/app/api/search/route.ts` | Passthrough puro de TMDB — entrou aqui só pela MESMA razão de "episode" (chave sem `EXPO_PUBLIC_`, decisão já tomada) |
| `tmdb-catalog` (`"movie-details"`) | `apps/web/app/api/tmdb/movie/[id]/route.ts` | Idem |
| `tmdb-catalog` (`"explore"`) | `apps/web/app/api/tmdb/explore/route.ts` | Idem |
| `tmdb-catalog` (`"upcoming"`) | `apps/web/app/api/tmdb/upcoming/route.ts` | Idem |
| `tmdb-catalog` (`"genres"`) | `apps/web/app/api/tmdb/genres/route.ts` | Idem |

Nenhuma rota em `apps/web` foi alterada — todas continuam existindo e
funcionando normalmente pro site.

## 4. Formato das chamadas

`series-data` (`POST`, JSON):

```json
{ "operation": "details", "seriesId": 1399, "language": "pt-BR" }
{ "operation": "episode-context", "seriesId": 1399, "season": 3, "language": "pt-BR" }
{ "operation": "episode", "seriesId": 1399, "season": 3, "episode": 1, "language": "pt-BR" }
{ "operation": "episodes-at-export", "seriesIds": [1399, 1402], "language": "pt-BR" }
```

`tmdb-catalog` (`POST`, JSON):

```json
{ "operation": "search", "query": "Breaking Bad", "language": "pt-BR" }
{ "operation": "movie-details", "movieId": 603, "language": "pt-BR" }
{ "operation": "upcoming", "seriesIds": [1399, 1402], "language": "pt-BR" }
{ "operation": "genres", "language": "pt-BR" }
{ "operation": "explore", "list": "trending_series", "page": 1, "language": "pt-BR" }
{ "operation": "explore", "list": "genre_movies", "genreId": 28, "page": 1, "language": "pt-BR" }
{ "operation": "explore", "list": "similar_series", "anchorId": 1399, "page": 2, "source": "recommendations", "language": "pt-BR" }
```

## 5. Falhas de gravação de cache — await vs. waitUntil

`media_summaries_cache` (`library-summaries`) e `season_recaps`
(`season-recap`) continuam **aguardadas** (`await`) antes da
resposta — mesmo comportamento da rota Vercel original (lá também já
era síncrono/bloqueante, confirmado lendo o código original). Nenhuma
mudança de latência aqui.

`series_season_episode_counts` (usada por `series-data` nas
operações `"details"`, `"episode-context"` e `"episodes-at-export"`)
é diferente: na Vercel original, essa gravação é fire-and-forget
(`void cacheSeasonEpisodeCount(...)`), e o runtime Deno das Edge
Functions não garante que uma promise solta sem `await` termine depois
que a resposta já foi enviada. Em vez de `await` (que resolveria a
garantia de execução, mas adicionaria uma latência nova que a rota
Vercel nunca teve), a implementação usa
[`EdgeRuntime.waitUntil(...)`](https://supabase.com/docs/guides/functions/background-tasks) —
o mesmo primitivo já usado em `enrich-media-countries/index.ts` —, que
mantém o isolado vivo até a gravação terminar SEM bloquear a resposta.
Resultado: zero latência nova (igual à Vercel) + zero risco de perder
a gravação (corrige o bug real do fire-and-forget em Deno). Toda
falha de gravação, nas 3 tabelas, usa `console.error` (visível com
destaque em Supabase → Edge Functions → Logs) e nunca impede o retorno
dos dados da TMDB — o `try/catch` interno de `cacheSeasonEpisodeCount`/
`writeCache` garante isso independentemente de onde a promise é lida.

## 6. Autenticação — JWT e sessão expirada

Todas as 4 functions usam `verify_jwt = true` (padrão do Supabase).
`supabase.functions.invoke()`, no cliente mobile, anexa automaticamente
`Authorization: Bearer <access_token da sessão atual, ou a anon key
quando deslogado>` — nenhuma das chamadas migradas nesta fase precisou
de lógica de auth própria, porque isso é feito pelo SDK (`@supabase/supabase-js`),
não pelo código de cada `lib/*.ts`.

**Achado real desta validação** (não presumido — confirmado lendo
`apps/mobile/lib/supabase.ts` e `apps/mobile/app/_layout.tsx`): o
cliente mobile já tem `autoRefreshToken: true`, que mantém um timer
interno renovando o token ~60s antes de expirar — mas esse timer é um
`setTimeout`/`setInterval` do JS, que o React Native **pausa quando o
app vai para o background** (mesma limitação em qualquer app RN, não
é bug do SeenList). A documentação oficial do `supabase-js` para React
Native recomenda explicitamente um listener de `AppState` chamando
`supabase.auth.startAutoRefresh()`/`stopAutoRefresh()` ao
foreground/background — **este listener NÃO existe no projeto hoje**
(confirmado por busca em `_layout.tsx`, não há nenhuma referência a
`AppState` nem a `startAutoRefresh`/`stopAutoRefresh`). Isso não é uma
regressão desta Fase 1 — o mesmo risco já existe hoje pra QUALQUER
chamada Supabase do app (`supabase.from(...)`, `supabase.auth...`,
etc.), não é algo introduzido pelas Edge Functions novas. Mas como as
5 functions desta fase são as primeiras do app que dependem de JWT
sendo validado no "gateway" (401 antes mesmo da function rodar, em vez
de uma policy de RLS que poderia devolver dados parciais), um usuário
que reabre o app depois de muito tempo em background — tempo
suficiente pro access token expirar sem o timer ter rodado — pode
receber um 401 na primeira chamada a qualquer uma destas 5 functions,
até a sessão se renovar.

**Como cada chamador trata isso hoje** (revisado nesta validação): o
`error` de `supabase.functions.invoke()` é tratado de forma genérica
em todos os call sites migrados — não há distinção entre "401 por
sessão expirada" e qualquer outro erro de rede. Na prática:
`library.ts`/`seasonRecap.ts` tratam qualquer erro como "sem dado
desta vez" (retorno `null`/lista vazia, sem travar a tela);
`episodeDetails.ts`/`search.ts`/`movieDetails.ts`/`tmdb-catalog`
(explore/upcoming/genres) relançam o erro, que sobe pro React Query ou
pro catch da tela — comportamento equivalente ao que a rota Vercel já
tinha quando `!response.ok` (nenhuma piora). Ou seja: um 401 por
sessão expirada não quebra o app de forma nova — ele já é tratado como
"essa chamada falhou, tenta de novo" — mas também não dispara
nenhuma renovação ATIVA de sessão antes de tentar de novo; a
renovação só acontece quando o timer interno do `autoRefreshToken`
rodar (próxima vez que o app estiver em foreground por tempo
suficiente) ou na próxima ação que force `getSession()`.

**Isto não foi corrigido nesta sessão** — é uma lacuna na
infraestrutura de autenticação do app inteiro, não específica das
Edge Functions, e expandir o escopo pra isso não foi pedido. Como o
projeto pede "nunca tome grandes decisões, dê as opções": a correção
(adicionar o listener de `AppState` em `_layout.tsx` ou em
`lib/supabase.ts`) é pequena e de baixo risco, mas muda o
comportamento de autenticação do app inteiro — fica como pendência
reportada, aguardando decisão sobre fazer ou não nesta fase.

## 7. Validação TypeScript / Deno

Esta sessão verificou sintaxe (parser TypeScript, sem acesso a
`device_bash`/terminal no seu computador) em todos os arquivos novos e
editados — nenhum erro de parsing encontrado. **Não substitui** uma
validação de tipos completa entre arquivos. Rode manualmente antes do
deploy:

```bash
# Mobile — tipos de apps/mobile inteiro, incluindo os 10 arquivos editados nesta fase
cd apps/mobile && npx tsc --noEmit

# Edge Functions — Deno confere cada arquivo e seus imports (jsr:@supabase/supabase-js incluso)
deno check supabase/functions/library-summaries/index.ts
deno check supabase/functions/season-recap/index.ts
deno check supabase/functions/series-data/index.ts
deno check supabase/functions/tmdb-catalog/index.ts
```

(`deno check` precisa do Deno CLI instalado — mesmo requisito que
`supabase functions deploy` já tem, que também usa Deno por baixo.)
