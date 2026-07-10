# Formato real do export GDPR do TV Time

> ⚠️ **OBSOLETO — não é a fonte de verdade.** Este documento foi escrito
> (TASK-027A) com base em pesquisa online sobre ferramentas de terceiros, sem
> nenhum arquivo real em mãos. A inspeção direta de um arquivo GDPR real
> (TASK-027A.1) provou que os nomes de arquivo citados aqui
> (`tracking-prod-records-v2.csv`, `tracking-prod-records.csv`) **não
> existem no export real**. Use **`/docs/tvtime-gdpr-spec.md`** — baseado
> inteiramente na inspeção de um arquivo real, essa é a referência atual.
> Este arquivo fica preservado só como registro histórico de como a
> hipótese anterior chegou a ser construída e por que estava errada.

> Referência oficial do importador do SeenList. Substitui qualquer suposição
> anterior (ver TASK-027, que assumiu 5 arquivos como `followed_tv_show.csv`,
> `watched_on_episode.csv` etc. — **esses arquivos não existem no export
> real** e foram completamente abandonados nesta revisão).

## Como este documento foi construído

Eu (Claude) não tenho um arquivo GDPR real do TV Time em mãos para inspecionar
diretamente. Nenhuma parte deste documento vem de "eu ter aberto um ZIP real".
O que existe aqui vem de duas fontes verificáveis:

1. **Leitura do código-fonte de ferramentas que processam exports reais de
   usuários** — principalmente [`lukearran/TvTimeToTrakt`](https://github.com/lukearran/TvTimeToTrakt),
   um script Python com centenas de usuários reais, cujo `TimeToTrakt.py` lê
   colunas específicas por nome.
2. **Relatos de cobertura jornalística e de outras plataformas de migração**
   (TVmaze, que lançou um importador dedicado em 02/07/2026 testado contra
   arquivos reais enviados por usuários; reportagens sobre o encerramento do
   TV Time em 15/07/2026) que descrevem o formato do arquivo.

Cada afirmação abaixo é marcada como:
- **CONFIRMADO** — visto diretamente em código que roda contra arquivos reais.
- **INFERIDO** — dedução razoável (convenção de nome, necessidade funcional),
  ainda não confirmada contra um arquivo real. Precisa ser validada assim que
  alguém rodar o importador contra um export de verdade — é exatamente pra
  isso que o modo de diagnóstico (seção final deste documento) existe.

## Estrutura do ZIP

O export gerado em `gdpr.tvtime.com` é um `.zip`. **CONFIRMADO**: os dois
arquivos relevantes para tracking são:

```
tracking-prod-records-v2.csv   ← séries e episódios
tracking-prod-records.csv      ← filmes
```

Isso é uma mudança de modelo importante em relação à hipótese anterior: **não
são 5 arquivos de propósito único** (um pra "séries seguidas", outro pra
"episódios assistidos" etc.) — são **dois arquivos de log de eventos**, cada
um com uma coluna discriminadora (`type`) que diz que tipo de evento aquela
linha representa.

Há relatos (fórum do Trakt, 2025) de uma versão do export que trazia **só
JSON, sem nenhum CSV** — o formato já mudou pelo menos uma vez no passado.
Isso é o motivo do parser (seção "Resiliência" abaixo) nunca assumir que o
arquivo *tem* que se chamar exatamente isso, e do validador nunca travar a
importação inteira por causa de uma variação de nome.

Outros arquivos podem existir dentro do ZIP (perfil, configurações de conta,
dados de dispositivo etc.) — não são utilizados pelo SeenList. Ver seção
"O que o SeenList explicitamente ignora".

## `tracking-prod-records-v2.csv` — séries e episódios

### O que representa

Um log de eventos relacionados a séries/episódios. Cada linha é um evento —
não é uma linha por série, é potencialmente uma linha por (série, episódio,
tipo de evento).

### Colunas

| Coluna | Status | Descrição |
|---|---|---|
| `series_name` | **CONFIRMADO** | Nome da série, como o TV Time o conhece. É o campo usado para buscar a série no TMDB. |
| `episode_number` | **CONFIRMADO** | Número do episódio. Uma linha sem isso preenchido não é um evento de episódio (o `TimeToTrakt.py` real pula a linha inteira quando esse campo vem vazio). |
| `season_number` | INFERIDO | Segue a convenção de `episode_number`; necessário para reconstruir progresso por temporada. Ainda não confirmado o nome exato da coluna. |
| `type` | INFERIDO (por analogia com o arquivo de filmes, onde é CONFIRMADO) | Discriminador do tipo de evento. No arquivo de filmes existe com certeza (valor observado: `"watch"`). É razoável esperar o mesmo padrão aqui, mas isso ainda não foi visto diretamente no arquivo de séries. |
| `updated_at` / `watched_at` / campo de data | INFERIDO | Necessário para saber quando o episódio foi marcado como assistido. Nome exato desconhecido. |
| Identificador da série (TVDB id ou similar) | INFERIDO | O TV Time historicamente usa TheTVDB como fonte de dados — é razoável esperar um id numérico de série na linha, mas o parser não depende disso: usa `series_name` como chave. |

### Como deve ser utilizado

1. Filtrar linhas onde `type` indica um evento de "assistido" (ver seção
   "Resiliência" — o parser aceita variações como `watch`, `watched`, `seen`).
2. Agrupar por `series_name`.
3. Para cada série, construir a lista de `(season_number, episode_number)`
   assistidos.
4. A temporada/episódio mais alto encontrado é o que alimenta a desambiguação
   por histórico já existente (`disambiguateByHistory.ts`) — isso não mudou.
5. Linhas cujo `type` não é reconhecido são contadas e reportadas no modo de
   diagnóstico, não descartadas silenciosamente.

## `tracking-prod-records.csv` — filmes

### O que representa

O mesmo modelo de log de eventos, para filmes.

### Colunas

| Coluna | Status | Descrição |
|---|---|---|
| `movie_name` | **CONFIRMADO** | Nome do filme. |
| `type` | **CONFIRMADO** | Discriminador de evento — valor `"watch"` confirmado em uso real. Podem existir outros valores (ex.: relacionados a avaliação/voto — a TVmaze menciona "Votes" como um tipo de dado presente no export que ela ainda não consegue mapear, o que sugere a existência de eventos de voto/nota nesse mesmo arquivo ou em `-v2.csv`). |

### Como deve ser utilizado

1. Filtrar linhas onde `type` indica "assistido".
2. Cada `movie_name` único vira um filme candidato para busca no TMDB.

## Favoritos e listas

**Não confirmado onde moram.** A hipótese anterior (arquivo dedicado
`lists-prod-lists.csv`) não tem nenhuma evidência real a favor nem contra —
simplesmente não apareceu em nenhuma fonte consultada nesta investigação. A
hipótese mais provável, dado que os dois arquivos confirmados já usam o
padrão "log de eventos com `type`", é que favoritos/listas sejam **outro
valor de `type`** dentro dos mesmos dois arquivos (ex.: `type=favorite`,
`type=list_add`), não um arquivo à parte. O parser tenta reconhecer isso (ver
`trackingRecords.ts`), mas isso é a inferência menos sustentada deste
documento — é a primeira coisa a corrigir quando um arquivo real for testado.

## O que o SeenList explicitamente ignora

Dados de conta, dispositivo, comentários, reações, badges, e qualquer
conteúdo comunitário não fazem parte do export GDPR de tracking (confirmado
por múltiplas fontes jornalísticas sobre o encerramento do TV Time) — não há
nada a ignorar ativamente porque esses dados simplesmente não vêm nesse
arquivo.

## Resiliência do parser

Como o formato já mudou pelo menos uma vez (CSV → JSON → CSV, conforme
relatos do fórum do Trakt), o parser:

- Aceita variações no nome do arquivo (`tracking-prod-records-v2.csv`,
  `tracking-prod-records-v2`, sem hífen, etc. — comparação por nome
  normalizado, não por igualdade exata de string).
- Aceita variações no nome de coluna, igual ao padrão já usado no resto do
  importador (`firstColumn` com lista de aliases).
- Nunca lança exceção e aborta a importação inteira por causa de uma coluna
  ausente — registra o problema (modo de diagnóstico) e segue com o que
  conseguiu interpretar.
- Se o arquivo vier em JSON em vez de CSV (formato já visto acontecer no
  passado), a validação do ZIP detecta isso e informa claramente ao usuário
  em vez de simplesmente não encontrar nenhum registro.

## Modo de diagnóstico (desenvolvimento)

Ativo apenas quando `NODE_ENV=development`. Ao final de uma importação,
gera um relatório com: arquivos encontrados, arquivos ausentes, contagem de
registros lidos por arquivo, contagem de séries/episódios/favoritos
importados, contagem de registros descartados com o motivo, e tempo total.
Ver `apps/web/lib/tvtime-import/diagnostics.ts`.

Esse relatório é a ferramenta para fechar as lacunas "INFERIDO" deste
documento assim que alguém rodar a importação contra um arquivo real — sem
precisar de nova investigação, só rodar e ler o relatório.
