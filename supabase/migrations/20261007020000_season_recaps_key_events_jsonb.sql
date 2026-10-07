-- Resumo da Temporada — polimento visual pedido pelo usuário depois do
-- 1º teste real: "Principais acontecimentos" deixa de ser um parágrafo
-- único e vira uma lista de acontecimentos discretos (numerados na UI).
-- `key_events` muda de `text` (uma string) pra `jsonb` (array de
-- strings) — `jsonb` em vez de `text[]` de propósito, pra poder
-- evoluir o formato de cada item no futuro (ex.: anexar o número do
-- episódio) sem precisar de outra migration de tipo de coluna.
--
-- Recaps já gravados com o formato antigo (string única) ficam
-- tecnicamente incompatíveis com o novo formato — mas isso NÃO precisa
-- de backfill nem de apagar nada manualmente aqui: o bump de
-- `SEASON_RECAP_PROMPT_VERSION` (ver seasonRecapPrompt.ts) + a
-- comparação de `prompt_version` que a rota passa a fazer na leitura
-- do cache tratam qualquer linha com versão antiga como cache frio —
-- regenera sozinha, sob demanda, na próxima vez que alguém abrir
-- aquela temporada.
--
-- As linhas existentes (só testes desta sessão, nenhum dado real de
-- usuário) são apagadas antes de trocar o tipo da coluna: a string em
-- prosa do formato antigo não tem conversão nenhuma pra um array de
-- eventos discretos, e `key_events` continua `not null` — manter as
-- linhas e tentar converter pra `null` quebraria essa constraint. Uma
-- `delete` explícito, não um `truncate`, só pra deixar claro no log da
-- migration quantas linhas saíram.
delete from public.season_recaps;

alter table public.season_recaps
  alter column key_events type jsonb
  using to_jsonb(key_events);
