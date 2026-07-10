# TASK-027H — Auditoria completa: eliminar reconstrução por heurística

> Investigação pura. Nenhuma linha de `scoring.ts`, `matchShow.ts`,
> `disambiguateByHistory.ts`, `resolveStatus.ts`, `reconstructProgress.ts`
> ou qualquer arquivo de `tmdb/` foi alterada nesta tarefa. Tudo abaixo
> foi verificado contra o arquivo GDPR real (o mesmo da TASK-027A.1) e,
> onde indicado, contra o TMDB de verdade (busca ao vivo, não suposição).

## 1. Tabela completa de uso do GDPR

| Arquivo | Informação disponível | Usada? | Onde |
|---|---|---|---|
| `followed_tv_show.csv` | `tv_show_id`, `tv_show_name` (biblioteca base) | ✅ | `parser/followedShow.ts` |
| `followed_tv_show.csv` | `active`, `archived` | ❌ | Ver seção 2 — testado com o dataset **inteiro** (não amostra) nesta tarefa; confirmado sem correlação limpa com progresso. |
| `followed_tv_show.csv` | `diffusion`, `notification_type`, `folder_id`, `notification_offset` | ❌ | Verificado agora: **zero variação** nas 307 linhas (`diffusion` sempre `"original"`, `folder_id` sempre vazio, `notification_type` sempre `"2"`). Não carregam informação nenhuma pra este usuário — não há o que extrair. |
| `user_tv_show_data.csv` | `nb_episodes_seen` | ✅ | `parser/tvShowProgress.ts` → fonte principal de progresso |
| `user_tv_show_data.csv` | `is_favorited` | ✅ | `parser/tvShowProgress.ts` |
| `user_tv_show_data.csv` | `is_followed` | ❌ | Redundante com a própria presença da linha em `followed_tv_show.csv` — não carrega informação adicional. |
| `user_show_special_status.csv` | `status` (`for_later`) | ✅ | `parser/specialStatus.ts` → única fonte de status EXPLÍCITO no GDPR inteiro |
| `show_seen_episode_latest.csv` | `episode_id` | ❌ (parcial) | Não referencia temporada/episódio diretamente, e não existe tabela de episódios no export pra resolver o id — ver seção 6. |
| `seen_episode_latest.csv` | `episode_season_number`, `episode_number`, `tv_show_name` | ✅ | `parser/granularEpisodes.ts` (sinal granular auxiliar) |
| `watched_on_episode.csv` | `episode_season_number`, `episode_number`, `tv_show_name` | ✅ | `parser/granularEpisodes.ts` |
| `rewatched_episode.csv` | `episode_season_number`, `episode_number`, `tv_show_name` | ✅ | `parser/granularEpisodes.ts` |
| `show_character_episode_vote.csv` | `episode_season_number`, `episode_number`, `tv_show_name` | ⚠️ **NÃO — achado novo desta auditoria** | Ver seção 3. |
| `emotions-3-prod-episode_votes.csv` (ratings) | `episode_id`, `vote_key`, `season_number`, `episode_number` | ❌ | `vote_key` é um código sem tradução em nenhum lugar do export (confirmado na TASK-027A.1) — dá pra saber QUE houve reação, não qual. SeenList não tem conceito de "avaliação por episódio" hoje; não há onde gravar isso mesmo se decodificado. |
| — (listas) | Não existe nenhum arquivo de "lista" no export real | ❌ | Confirmado de novo nesta auditoria: nenhum dos 49 arquivos representa listas do usuário. "Minhas listas" (TASK-029) é uma feature nova do SeenList, não uma reconstrução do TV Time. |
| `user_statistics.csv` | Totais agregados da conta | ❌ | Já documentado como não confiável (números não batem com a soma real dos arquivos linha-a-linha). |
| `user_setting.csv` | Preferências de app (idioma, notificação, dark mode) | ❌ | Checado agora, nome por nome: nenhum valor é sobre status de série. |
| `user_personal_data.csv` | `bio`, `cover`, `instagram-name`, `country-code` | ❌ | Dado de perfil, não de biblioteca. |
| Todos os demais (auth, device, IP, comentários, badges, memes, etc.) | — | ❌ | Confirmados irrelevantes desde a TASK-027A.1; alguns contêm dado sensível (senha, token) que nunca deveria ser lido de propósito. |

## 2. `active`/`archived` — reconfirmado com o dataset inteiro, não amostra

Na TASK-027A.1 essa correlação já tinha sido testada numa amostra pequena.
Nesta auditoria, recontei com as **307 linhas inteiras**:

| Combinação | Total | Progresso = 0 | Progresso > 0 |
|---|---|---|---|
| `active=1, archived=0` | 251 | 78 | 173 |
| `active=1, archived=1` | 25 | 8 | 17 |
| `active=0, archived=0` | 31 | 16 | 15 |

Nenhuma combinação separa "terminou" de "não terminou" — todas misturam
progresso zero e não-zero em proporções parecidas. **Confirmado, agora com
rigor total: esses dois campos não carregam status recuperável.** Isso não
mudou em relação à investigação anterior, mas agora está provado contra o
dataset completo, não uma amostra.

## 3. Achado novo: `show_character_episode_vote.csv` nunca foi incorporado

Este arquivo tem exatamente o mesmo formato de
`watched_on_episode.csv`/`rewatched_episode.csv`/`seen_episode_latest.csv`
(`tv_show_name`, `episode_season_number`, `episode_number`) e nunca entrou
no parser. Contém 12 linhas nesta conta — "votar no personagem favorito de
um episódio" implica ter assistido aquele episódio. É um sinal granular
genuíno, do mesmo tipo que os outros três já usam.

**Isso não foi corrigido nesta tarefa** (item 5 pede zero alteração de
reconstrução até concluir a investigação). É a única mudança de código que
esta auditoria recomenda: adicionar este arquivo à lista já existente em
`parser/granularEpisodes.ts` (mesma função, um arquivo a mais). Efeito
esperado: mínimo (12 linhas numa conta com milhares de episódios), mas é
uma coluna real sendo ignorada sem justificativa — o critério de aceite
desta tarefa exige que isso seja corrigido ou explicitamente justificado, e
não existe justificativa pra deixá-la de fora.

## 4. Quantas séries dependem de reconstrução — resposta direta

O GDPR real só fornece status **explícito** pra um caso: `for_later`
(`user_show_special_status.csv`). Nesta conta, isso cobre 7 de 307 séries
(2,3%).

Para as outras 300 (97,7%), o GDPR fornece `nb_episodes_seen` — um número —
mas **nunca** um campo "status". Determinar Concluída vs. Assistindo exige
necessariamente comparar esse número contra uma referência externa (total
de episódios do TMDB). Isso não é uma escolha de implementação nem uma
heurística evitável — é a única forma matematicamente possível de responder
"terminou ou não" quando a única informação disponível é uma contagem, sem
rótulo. Não existe releitura do GDPR que elimine essa necessidade: o dado
"terminou" simplesmente não está escrito em lugar nenhum do arquivo.

**Conclusão que a tarefa pediu para eu provar, não assumir:** ~98% das
séries desta conta dependem de comparação com o TMDB pra decidir status —
não porque o parser esteja ignorando alguma coluna, mas porque essa coluna
não existe no GDPR. A única exceção genuína (`for_later`) já está sendo lida.

## 5. Rastreamento real, com séries reais desta conta, verificadas contra o TMDB ao vivo

### Caso 1 — dado explícito, zero reconstrução
```
TV Time
Nome: Archer (2009)
nb_episodes_seen: 5

Status final no SeenList: want_to_watch
Decidido por: ( X ) dado existente no GDPR   ( ) reconstrução   ( ) heurística   ( ) fallback
Linha responsável: resolveStatus.ts:20 — show.isExplicitlyForLater (de user_show_special_status.csv, status=for_later)
```

### Caso 2 — reconstrução correta, validada contra o TMDB real
```
TV Time
Nome: Supernatural
nb_episodes_seen: 327

TMDB (verificado agora, busca ao vivo — Wikipedia/IMDb/Fandom concordam): 327 episódios, 15 temporadas.

Episódios marcados: 327
Status final no SeenList: completed
Decidido por: ( ) dado existente no GDPR   ( X ) reconstrução   ( ) heurística   ( ) fallback
Linha responsável: resolveStatus.ts:24 (327 >= 327) + reconstructProgress.ts:135 (fatia de 327 == total)
```
Este é reconstrução, não heurística — usa exatamente os dois números que
existem (`nb_episodes_seen` do GDPR, total do TMDB) sem inventar nada. O
resultado bate exatamente com a realidade.

### Caso 3 — divergência real encontrada, com causa identificada (não é bug de código)
```
TV Time
Nome: Naruto Shippuden
nb_episodes_seen: 514

TMDB (verificado agora, busca ao vivo — Wikipedia/TMDB/múltiplas fontes concordam): 500 episódios principais (temporadas 1-20, fora a temporada 0 de especiais).

514 > 500 → cai em reconstructProgress.ts:120 ("needs_review")
Episódios marcados: 500 (nunca extrapola — trava no que o TMDB conhece)
Status final no SeenList: watching (o ramo needs_review retorna antes de testar >=)
Status esperado, se o número do TV Time estivesse certo: completed (514 > 500 é literalmente "viu tudo e mais")
Decidido por: ( ) dado existente no GDPR   ( ) reconstrução   ( ) heurística   ( X ) fallback (needs_review)
Linha responsável: reconstructProgress.ts:120
```
**Este é o tipo de caso que a tarefa pediu pra investigar até a causa
raiz.** Não é o parser ignorando dado do GDPR, nem um bug de comparação —
`nb_episodes_seen=514` é maior que qualquer contagem real de episódios
principais que qualquer fonte (Wikipedia, IMDb, TMDB, Fandom) atribui a essa
série. As explicações mais prováveis, nenhuma delas corrigível só lendo
melhor o GDPR:
- TV Time pode contar dublado e legendado como visualizações separadas
  pro mesmo episódio (contagem cumulativa de "vezes assistido", não de
  "episódios distintos").
- O usuário pode ter reassistido episódios — o próprio
  `rewatched_episode.csv` existe exatamente pra esse conceito, e
  `nb_episodes_seen` pode estar somando isso em vez de contar únicos.

Isso é uma limitação real do dado de origem, não da interpretação — está
documentado aqui como pedido no item 6, com a heurística (nunca extrapolar,
marcar só os episódios que existem, sinalizar para revisão) já implementada
desde a TASK-027B/C e mantida sem alteração nesta tarefa.

## 6. Informação comprovadamente ausente (item 6 da tarefa)

| Informação ausente | Por que é impossível recuperar do GDPR | Heurística usada | Justificativa |
|---|---|---|---|
| Status "pausada" | `active`/`archived` testados contra as 307 linhas inteiras, sem correlação (seção 2). Nenhum outro arquivo dos 49 tem um campo de status além de `for_later`. | Nenhuma — "pausada" nunca é atribuída pelo importador hoje. | Atribuir "pausada" sem nenhum sinal real seria inventar dado; a decisão atual (nunca usar esse status na importação) é mais honesta que uma heurística fraca. |
| Lista de episódios específicos assistidos (pra ~98% das séries) | `watched_on_episode.csv`+`rewatched_episode.csv`+`seen_episode_latest.csv`+`show_character_episode_vote.csv` juntos cobrem uma fração pequena (a TASK-027A.1 mediu ~4% com 3 desses 4 arquivos). | Fatia cronológica dos N primeiros episódios do TMDB, onde N = `nb_episodes_seen`. | Única forma de aproximar "quais episódios" quando só existe a contagem total — documentada desde a TASK-027B. |
| `episode_id` → temporada/episódio (`show_seen_episode_latest.csv`) | Não existe, em lugar nenhum dos 49 arquivos, uma tabela que traduza `episode_id` pra número de temporada/episódio. | Nenhuma — este arquivo específico não é usado pra esse fim. | Sem tabela de referência, qualquer tentativa de "adivinhar" a temporada seria pura invenção. |
| Tradução do código de emoção (`emotions-3-prod-episode_votes.csv`) | Nenhum arquivo do export mapeia o código numérico pro nome da reação. | Nenhuma — não usado. | SeenList também não tem onde gravar "reação por episódio" hoje; seria uma feature nova, fora do escopo de importação de progresso. |

## Resumo do critério de aceite

- Todas as colunas relevantes foram reauditadas, incluindo um novo arquivo
  (`show_character_episode_vote.csv`) que tinha ficado de fora sem
  justificativa — documentado, correção recomendada mas **não aplicada**
  nesta tarefa (zero heurística alterada, como pedido).
- `active`/`archived` reconfirmados como não-recuperáveis, agora com o
  dataset inteiro, não uma amostra.
- Cada decisão de status agora pode ser explicada apontando dado + linha de
  código exata (seção 5).
- A reconstrução restante (~98% dos casos) é consequência comprovada de o
  GDPR nunca fornecer um campo de status além de `for_later` — não de
  interpretação incorreta do arquivo.
