# Fixtures de teste — TASK-027B

Diferente da rodada anterior de fixtures (TASK-027A, apagada — foi
construída em cima de arquivos que a inspeção real provou não existir),
estas AGORA usam exatamente os nomes de arquivo e nomes de coluna
confirmados por inspeção direta de um export GDPR real (ver
`/docs/tvtime-gdpr-spec.md`).

Os dados dentro dos arquivos (nomes de série, ids, contagens) continuam
sendo sintéticos/inventados — não são de uma conta real — mas a
**estrutura** (nome de arquivo, nome de coluna, formato de valor) é a
mesma confirmada no arquivo real inspecionado em 05/07/2026.

Cenários cobertos de propósito:
- `Breaking Bad` (1001): progresso parcial (62 vistos) + 2 episódios
  granulares reais em `watched_on_episode.csv`, dentro da fatia reconstruída
  (não deveria reduzir a confiança).
- `The Office (US)` (1002): progresso alto (195), sem nenhum dado granular
  — o caso mais comum no arquivo real (baixa cobertura de
  `watched_on_episode.csv`).
- `Archer` (1003): `active=0` em `followed_tv_show.csv` E status explícito
  `for_later` em `user_show_special_status.csv` — testa que o status
  explícito manda, não o active/archived (que a investigação real
  mostrou não ser confiável).
- `Friends` (1004): 0 episódios vistos, mas favoritado — testa que
  "assistir depois" e "favorito" são independentes.
- `Smallville` (1005): 0 episódios vistos, sem nada especial — o caso
  "assistir depois implícito" mais comum no arquivo real.
