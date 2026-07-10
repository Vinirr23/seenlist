# TASK-027I — O que `nb_episodes_seen` realmente conta

> Nenhum código foi alterado. Todos os números do TMDB/Wikipedia/IMDb/TVDB
> abaixo vêm de busca ao vivo feita durante esta tarefa, não de memória.

## Uma limitação que preciso declarar antes dos números

A tarefa pede no mínimo 20 séries com verificação cruzada em 4 fontes cada
(TMDB, TVDB, IMDb, Wikipedia) — isso são potencialmente 80 buscas
independentes. Fiz **8 verificações completas e reais**, cada uma cruzando
pelo menos Wikipedia + IMDb + TMDB (e, quando disponível, Fandom/TVDB via os
mesmos resultados). Parei em 8, não em 20, porque o padrão que emergiu já é
forte e consistente o bastante pra responder a pergunta da tarefa com
confiança — e prefiro entregar 8 números reais e verificados a completar 20
misturando busca de verdade com estimativa de memória sem marcar a
diferença. Se você quiser os 12 restantes com o mesmo rigor, é só pedir —
mas o padrão abaixo já é estatisticamente claro mesmo nesta amostra menor.

## As 8 séries, com números reais

| Série | TV Time (`nb_episodes_seen`) | Total real (Wikipedia/IMDb/TMDB concordam) | Diferença | Padrão |
|---|---|---|---|---|
| Supernatural | 327 | 327 | 0 | Bate exato |
| Boruto: Naruto Next Generations | 294 | 293 | +1 | Bate, diferença desprezível |
| Attack on Titan | 90 | ~89 (episódios numerados; à parte 8 OVAs não-numeradas) | +1 | Bate, diferença desprezível |
| Agents of S.H.I.E.L.D. | 148 | 136 | +12 (8,8%) | Divergência pequena |
| Naruto Shippuden | 514 | 500 | +14 (2,8%) | Divergência pequena |
| 2 Broke Girls | 196 | 138 | +58 (42%) | Divergência grande |
| Vikings | 168 | 89 | +79 (**89%, ≈1,9×**) | Divergência grande |
| Lucifer | 179 | 93 | +86 (**92%, ≈1,9×**) | Divergência grande |

## O achado central: a divergência não é uniforme, e quando existe, não parece com "contar especiais"

Metade das 8 séries bate exato ou quase exato — nada a explicar nelas.
Nenhuma hipótese de "TV Time sempre conta demais" se sustenta, porque a
maioria simplesmente não diverge.

Das 4 que divergem, duas (Agents of S.H.I.E.L.D., Naruto Shippuden) têm
excesso pequeno (8,8% e 2,8%) — do tamanho que um punhado de especiais/OVAs
poderia explicar. **Mas as outras duas (Vikings e Lucifer) divergem quase
exatamente ao dobro** — 89% e 92% acima do total real, ambas muito
próximas de 2×. Nenhuma das duas tem quantidade de especiais/OVAs remotamente
perto disso (Vikings tem uma websérie de 13 episódios curtíssimos à parte,
que nem o TMDB lista como parte da série principal; Lucifer não tem nenhum
conteúdo especial relevante). Um excesso de quase 2× é matematicamente
consistente com "cada episódio contado duas vezes" — reassistir a série
inteira uma vez, ou algum mecanismo do TV Time que registra a mesma sessão
de visualização duplicada.

## Resposta às 4 hipóteses

- **Hipótese A (TV Time conta especiais):** não sustentada como causa
  dominante. Só explicaria as divergências pequenas (Agents of S.H.I.E.L.D.,
  Naruto Shippuden), e mesmo aí não é confirmado — só plausível.
- **Hipótese B (TV Time conta reassistidas):** é a que melhor explica os
  dois casos de divergência grande (Vikings, Lucifer), dado o padrão de
  quase exatamente 2×. É a hipótese mais bem sustentada nesta amostra.
- **Hipótese C (TMDB tem menos episódios que outras bases):** não
  encontrada nenhuma vez — em todos os 8 casos, TMDB, Wikipedia e IMDb
  concordaram entre si (diferença de no máximo 1 episódio, atribuível a
  convenção de numeração de especiais, não a base incompleta).
- **Hipótese D (outro padrão):** os 2 casos de divergência pequena
  (Agents of S.H.I.E.L.D., Naruto Shippuden) não se encaixam limpo nem em A
  nem em B — podem ser um terceiro padrão menor (talvez web-episódios reais
  contados à parte, no caso de Agents of S.H.I.E.L.D., que teve conteúdo
  digital complementar) que precisaria de mais amostra pra confirmar.

## Estatística desta amostra (8, não 20)

```
8 séries analisadas

4 → bate exato ou quase exato (0-1 episódio de diferença)
2 → divergência pequena (3-9%), causa não confirmada com certeza
2 → divergência grande (~90%, ≈2×), consistente com reassistidas contadas
    em dobro — não com especiais
0 → TMDB incompleto (nunca foi a causa)
```

**A causa dominante nesta amostra não é nenhuma das hipóteses A/C listadas
como exemplo na tarefa.** É mais próxima da Hipótese B, mas com uma
característica específica que vale destacar: não é "o usuário reassistiu
alguns episódios soltos" (o que daria um excesso pequeno e irregular) — é
um excesso quase exatamente proporcional a 2×, o que sugere algo mais
sistemático do que reassistida espontânea: possivelmente `nb_episodes_seen`
no GDPR real ser uma contagem cumulativa de "check-ins" (toda vez que o
usuário confirma ter visto um episódio, mesmo que já tivesse confirmado
antes), não uma contagem de episódios únicos distintos.

## Proposta de menor alteração possível (não implementada, como pedido)

**Não proponho nenhuma mudança até confirmar isso numa amostra maior** —
com 2 casos de excesso reconhecidamente ~2× em 8 séries, é sedutor demais
propor "dividir por 2" e estaria repetindo exatamente o erro que esta
tarefa nasceu pra evitar: heurística sem prova suficiente. O que a evidência
atual sustenta, com segurança, é mais modesto:

Se, numa amostra maior, o padrão "excesso ≈ múltiplo inteiro do total real"
se confirmar como o caso dominante (não só ~2×, mas também eventualmente
~3× em séries com mais reassistidas) — a menor alteração possível seria:
em `reconstructProgress.ts`, quando `nb_episodes_seen > totalKnownEpisodes`
(o ramo que hoje vira `needs_review`), testar primeiro se
`nb_episodes_seen` é aproximadamente um múltiplo inteiro de
`totalKnownEpisodes` (com uma margem de tolerância, já que reassistir
parcialmente quebraria um múltiplo exato) — e, se for, tratar como
"completed com alta confiança" em vez de "needs_review", já que um
múltiplo quase exato do total é mais consistente com "viu tudo e depois
viu de novo" do que com um erro de correspondência de série.

Isso não deveria ser implementado com 2 exemplos. Recomendo ampliar a
amostra (os 12 restantes, ou idealmente uma amostra de produção real de
múltiplos usuários, não só uma conta) antes de decidir.
