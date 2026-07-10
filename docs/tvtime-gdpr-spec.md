# Especificação real do export GDPR do TV Time

> Baseado exclusivamente na inspeção direta de um arquivo GDPR real,
> fornecido pelo usuário em 05/07/2026. Nenhuma parte deste documento vem de
> pesquisa online. Onde a pesquisa online anterior (`/docs/tvtime-gdpr.md`,
> TASK-027A) diverge deste arquivo real, **este documento prevalece**, e a
> divergência está registrada explicitamente na seção final.

Cada afirmação é marcada:
- ✅ **Confirmado pelo arquivo** — visto diretamente nos dados fornecidos.
- ⚠️ **Inferido** — dedução a partir do que existe, sem confirmação total.
- ❌ **Desconhecido** — não há como saber a partir deste arquivo.

## Descoberta mais importante: o formato real NÃO é o que a pesquisa online indicava

A pesquisa feita na TASK-027A (baseada em ferramentas de terceiros como
TvTimeToTrakt e no anúncio da TVmaze) apontava dois arquivos:
`tracking-prod-records-v2.csv` e `tracking-prod-records.csv`. **Nenhum dos
dois existe neste export real.** ✅ O export real tem **49 arquivos CSV**,
com nomes muito mais próximos da hipótese original da TASK-027
(`followed_tv_show.csv`, `watched_on_episode.csv`, `user_tv_show_data.csv`,
`show_seen_episode_latest.csv`) — que tinha sido abandonada por falta de
evidência, e se mostrou mais correta que a "correção" baseada em pesquisa.

Isso é registrado aqui sem meias palavras: a pesquisa online não é confiável
para este formato especificamente — provavelmente porque o formato do
export varia por período, tipo de conta, ou porque as ferramentas
pesquisadas trabalhavam com uma versão diferente (mais antiga ou mais nova)
do exportador do TV Time. A partir de agora, qualquer coisa que a internet
disser sobre o formato deve ser tratada como não confiável até ser
confirmada contra um arquivo real.

## Arquivos relevantes para importação

### `followed_tv_show.csv` — séries seguidas (307 linhas de dado)

**Finalidade:** ✅ lista de séries que o usuário segue/seguiu.

**Colunas:** ✅ `user_id, tv_show_id, active, diffusion, notification_type, folder_id, archived, notification_offset, created_at, updated_at, tv_show_name`

**Colunas realmente usadas para importação:** `tv_show_id`, `tv_show_name`, `created_at`.

**`active` e `archived`:** ✅ existem e variam de verdade nos dados
(`active=1,archived=0`: 251 séries; `active=0,archived=0`: 31 séries;
`active=1,archived=1`: 25 séries — nenhuma linha com `active=0,archived=1`
apareceu). ⚠️ **O que cada combinação SIGNIFICA não pôde ser determinado com
confiança** — cruzei essas combinações com o progresso (`nb_episodes_seen`)
de cada série e o resultado foi inconsistente: séries com `archived=1` têm
tanto 0 episódios vistos quanto 115; séries com `active=0` também variam de
0 a 59. Não existe uma correlação limpa com "pausada" ou "concluída". ❌
Sem uma segunda fonte de confirmação (o próprio app do TV Time, por
exemplo, mostrando o que cada estado visualmente significa), classificar
isso como "pausada" seria uma suposição de novo — exatamente o que esta
tarefa pediu para eliminar.

**`tv_show_id`:** ✅ é numérico. ❌ A que catálogo esse número pertence
(TheTVDB, ID interno do TV Time, ou outro) não está declarado em nenhum
lugar do export — não há como confirmar sem cruzar manualmente contra uma
base externa.

### `user_tv_show_data.csv` — progresso agregado por série (448 linhas)

**Finalidade:** ✅ contagem de episódios vistos por série, e dois booleanos
de status.

**Colunas:** ✅ `nb_episodes_seen, tv_show_name, user_id, tv_show_id, is_followed, is_favorited`

**Esta é a fonte confiável de progresso — não `watched_on_episode.csv`.**
✅ Confirmado: `nb_episodes_seen` é uma contagem agregada, não uma lista de
quais episódios especificamente. Soma total no arquivo: 9.816 episódios,
em 345 séries com progresso > 0.

**`is_favorited`:** ✅ a coluna existe de verdade, com esse nome exato —
isso substitui completamente a hipótese anterior de "favorito é um valor de
`type` dentro de um log de eventos" (TASK-027A), que estava errada. ⚠️
Nesta conta específica, `is_favorited=1` não aparece em nenhuma linha (todo
mundo tem valor `0`) — a coluna existe e a estrutura está confirmada, mas
não há exemplo real de uma linha favoritada para confirmar visualmente que
`1` de fato corresponde a "favoritado" na experiência do app. É a inferência
mais razoável dado o nome da coluna, mas tecnicamente ⚠️ o valor em si não
foi visto em uso.

**`is_followed`:** ✅ existe, mas 424 de 448 linhas têm valor `1` e nenhuma
linha tem valor diferente de `0` ou `1` — comportamento simples de boolean,
sem ambiguidade.

### `watched_on_episode.csv` — **NÃO é a lista completa de episódios assistidos** (18 linhas)

Este é o achado mais importante para a reconstrução de progresso.

**Finalidade real:** ⚠️ parece ser um log de check-ins feitos por uma via
específica (`watched_on_source_id` = `4` em **todas** as 18 linhas, sem
exceção) — não o histórico completo de tudo que a pessoa assistiu.

**Prova:** ✅ "The Office (US)" tem `nb_episodes_seen=195` em
`user_tv_show_data.csv`, mas **zero linhas** em `watched_on_episode.csv`.
De forma geral: das 345 séries com progresso > 0, **331 não aparecem em
nenhuma linha deste arquivo**. Isso não é uma coincidência de amostra — é a
prova de que este arquivo cobre uma fração muito pequena (aqui, ~4%) do
progresso real.

**Conclusão prática:** ❌ **não é possível reconstruir a lista completa de
"quais episódios especificamente foram assistidos" para a maioria das
séries a partir deste export.** O que dá para reconstruir com confiança é
"quantos episódios no total" (`nb_episodes_seen`), não "quais". Isso muda
fundamentalmente o que "importar 100% do progresso" pode significar na
prática — ver resposta à pergunta 4, no final deste documento.

**Colunas:** ✅ `episode_number, user_id, episode_id, watched_on_source_id, created_at, updated_at, tv_show_name, episode_season_number` — quando uma linha existe, ela É granular (tem temporada e episódio), só que a cobertura é baixa.

### `show_seen_episode_latest.csv` — último episódio visto por série (286 linhas)

**Finalidade:** ✅ um registro por série (a contagem de linhas, 285, é bem
próxima do total de séries seguidas, 307), guardando qual foi o último
episódio assistido — usado pelo TV Time para "continuar de onde parou".

**Colunas:** ✅ `tv_show_name, user_id, tv_show_id, episode_id, created_at, updated_at`

**Limitação real:** ⚠️/❌ este arquivo dá o `episode_id`, **não** o número
de temporada/episódio diretamente. Para converter `episode_id` em
"temporada X, episódio Y" seria necessário uma tabela de referência de
episódios que **não existe em nenhum lugar deste export**. Ou seja: dá para
saber QUE existe um "último episódio visto" registrado, mas não QUAL
temporada/episódio ele é, sem uma fonte externa (TheTVDB/TMDB) para
resolver esse id.

### `seen_episode_latest.csv` — fila recente, COM temporada/episódio (14 linhas)

Diferente do arquivo acima (nome muito parecido, conteúdo diferente).

**Finalidade:** ⚠️ parece ser uma fila curta de atividade bem recente (as
datas vão até 02/07/2026, dias antes deste export) — talvez um cache de
"últimas visualizações", não histórico permanente.

**Colunas:** ✅ `created_at, updated_at, tv_show_name, episode_season_number, episode_number, user_id, episode_id` — este SIM tem temporada/episódio diretamente.

**Uso prático:** ⚠️ útil como sinal extra pra poucas séries bem recentes, não como fonte de progresso geral (só 13 linhas de dado).

### `user_show_special_status.csv` — status explícito "assistir depois" (7 linhas)

**Finalidade:** ✅ confirmado, com o nome do status escrito por extenso.

**Colunas:** ✅ `user_id, tv_show_id, status, created_at, updated_at, tv_show_name`

**Valor de `status` observado:** ✅ **`for_later`** em todas as 7 linhas —
isto é literalmente "assistir depois", sem ambiguidade nenhuma.

**Cobertura:** ⚠️ só 7 de 307 séries seguidas aparecem aqui. A maioria das
séries "want to watch" (0 episódios vistos, sem estar arquivada) **não**
está marcada explicitamente aqui — elas só existem como uma linha comum em
`followed_tv_show.csv`/`user_tv_show_data.csv` com `nb_episodes_seen=0`.
Ou seja: **"assistir depois" tem duas formas de aparecer** — explícita
(`for_later` neste arquivo) ou implícita (seguida, mas com zero progresso).

### `rewatched_episode.csv` — episódios assistidos de novo (447 linhas)

**Finalidade:** ✅ registro de quando um episódio já visto foi assistido
outra vez (campo `cpt`, provavelmente "contador" de quantas vezes).

**Relevância pra importação:** ⚠️ secundário — o SeenList não tem conceito
de "reassistir" hoje. Dá pra usar como sinal adicional de quais episódios
específicos já foram vistos ALGUMA vez (título + temporada + episódio),
ampliando um pouco a cobertura pobre de `watched_on_episode.csv`, mas não
resolve o problema de fundo (ainda é um subconjunto, não a lista completa).

### `emotions-3-prod-episode_votes.csv` — avaliações por episódio (62 linhas)

**Finalidade:** ✅ é o arquivo de "avaliações" que a tarefa pediu para
localizar — o TV Time deixa o usuário reagir a um episódio com uma
"emoção".

**Colunas:** ✅ `episode_id, vote_key, user_id, series_name, season_number, episode_number`

**Limitação:** ❌ `vote_key` é um identificador composto
(`{episode_id}-{user_id}-{código})`), onde o código final (ex.: `37`, `28`,
`33`) provavelmente representa qual emoção foi escolhida — mas **não existe
neste export nenhuma tabela que traduza o código pra o nome da emoção**. Dá
pra saber QUE o usuário reagiu a um episódio específico, não COM QUAL
reação.

### `followed_tv_show_source.csv` — como cada série foi adicionada (76 linhas)

✅ Confirmado, `source` tem valores como `see-season`, `onboarding`.
⚠️ Não essencial para importação — é uma curiosidade de como o usuário
chegou a seguir a série, não afeta status/progresso.

## Filmes

❌ **Não existe nenhum arquivo relacionado a filme neste export.** Nenhum
dos 49 arquivos tem "movie" no nome ou no conteúdo. Isso pode significar
duas coisas, e não dá pra distinguir qual com este arquivo: (a) esta conta
específica nunca usou o recurso de rastrear filmes do TV Time, ou (b) o
TV Time simplesmente não inclui dados de filme no export GDPR de contas
focadas em série. **Não generalizar esta ausência para todo usuário** — só
documentar que, PARA ESTE arquivo, não há filme nenhum.

## Comentários, dados de conta e o que deve ser ignorado

✅ Confirmados e claramente fora do escopo de importação:
`episode_comment.csv`, `show_comment.csv`, `comment_translation.csv`,
`episode_comment_like.csv`, `show_comment_like.csv`,
`show_comments_last_read_date.csv` (comentários/comunidade);
`user.csv`, `auth-prod-login.csv`, `user_facebook_data.csv`,
`user_social_data.csv`, `user_personal_data.csv` (dados de conta/login —
**`auth-prod-login.csv` contém hash de senha e tokens de OAuth
criptografados; `user.csv` contém e-mail e tokens de terceiros** — nunca
devem ser lidos, logados ou armazenados pelo SeenList em nenhuma
circunstância);
`ip_address.csv` (436 linhas de histórico de IP/localização),
`user_connection.csv` (1932 linhas de histórico de login),
`device_data.csv`, `device_token.csv`, `installed_app.csv`,
`user_device.csv`, `user_platform.csv`, `user_session.csv`,
`refresh_token.csv`, `access_token.csv`, `webhook_data.csv`,
`_appsflyer_ids.csv`, `ad_identifier.csv`, `install_tracking.csv`
(infraestrutura/analytics, nada relacionado a assistir séries);
`user_badge.csv`, `user_leaderboard.csv`, `show_addiction_score.csv`,
`tv_show_user_emotion_count.csv`, `meme.csv`, `friend.csv`,
`user_facebook_like.csv` (gamificação/social, sem valor pra importação de
biblioteca); `gdpr_requests.csv`, `user_mail_sent_status.csv`,
`user_report_count.csv`, `user_setting.csv`, `user_last_updated.csv`,
`tracking-deployment-prod-tracks.csv` (2 linhas),
`tracking-prod-count-by-timeframe.csv` (0 linhas — completamente vazio
nesta conta).

`user_statistics.csv` merece uma nota à parte: ✅ existe e tem totais da
conta (`nb_episodes_watched`, `nb_shows_followed`), mas ⚠️ **os números
batem mal com a realidade**: mostra `nb_episodes_watched=0` (quando a soma
real, via `user_tv_show_data.csv`, é 9.816) e `nb_shows_followed=1117`
(quando `followed_tv_show.csv` tem 307 linhas). Esse arquivo parece estar
desatualizado/não mantido corretamente pelo próprio TV Time — **não usar
como fonte de verdade para nada**, os arquivos linha-a-linha são mais
confiáveis.

## Respostas às 4 perguntas finais

### 1. Quais arquivos realmente são necessários para importar o máximo possível de progresso?

- `followed_tv_show.csv` — biblioteca (quais séries).
- `user_tv_show_data.csv` — progresso agregado (`nb_episodes_seen`) e favoritos.
- `user_show_special_status.csv` — status explícito "assistir depois".
- `watched_on_episode.csv` + `rewatched_episode.csv` — os poucos episódios individuais que dá pra saber especificamente (cobertura baixa, mas é o que existe).
- `show_seen_episode_latest.csv` / `seen_episode_latest.csv` — sinal de "última atividade", com a limitação de `episode_id` não resolvido pra número de temporada/episódio no primeiro.

### 2. Quais arquivos podem ser ignorados?

Todos os listados na seção "Comentários, dados de conta e o que deve ser
ignorado" acima — comentários, dados de login/conta (alguns sensíveis),
analytics de dispositivo/IP, gamificação, e o arquivo de estatísticas
agregadas (que está inconsistente).

### 3. Quais arquivos ainda precisam ser investigados?

- `emotions-3-prod-episode_votes.csv` — o código numérico da emoção não é
  traduzível sem uma tabela externa; investigar se o app do TV Time (ou
  documentação de outra fonte confiável) revela o que cada número
  significa.
- O significado real de `active`/`archived` em `followed_tv_show.csv` —
  a correlação com progresso não foi conclusiva; precisaria comparar com o
  que o próprio app mostra visualmente para essas séries específicas.
- A que catálogo `tv_show_id`/`episode_id` pertencem (TheTVDB é a suposição
  mais provável, dado que o TV Time historicamente usa essa fonte, mas isso
  não está declarado em nenhum arquivo do export).

### 4. Existe alguma informação que simplesmente não existe no GDPR?

Sim, duas, e são importantes:

- **A lista completa de quais episódios específicos foram assistidos, para
  a maioria das séries.** Só existe a contagem total (`nb_episodes_seen`).
  Reconstruir "temporada 3, episódio 7 foi assistido" só é possível para
  uma fração pequena das séries (as que aparecem em
  `watched_on_episode.csv`/`rewatched_episode.csv`).
- **Dados de filme**, neste export específico — não há nenhum arquivo
  relacionado.
- **O nome/texto de cada reação de episódio** (emotions-votes) — só o
  código numérico, sem tradução.
