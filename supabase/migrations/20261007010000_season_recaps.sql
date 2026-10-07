-- Resumo da Temporada — cache de recap gerado por IA, compartilhado
-- entre todos os usuários (mesma receita de `media_summaries_cache`,
-- migration 20260905000000): chave composta, RLS SEM NENHUMA policy —
-- só a chave de serviço (rota /api/season-recap, server-only) lê/escreve.
-- O mobile nunca consulta esta tabela direto.
--
-- `where_it_ended` é NULLABLE DE PROPÓSITO: a regra de cobertura mínima
-- (auditoria, seção 7) exige que o episódio final da temporada tenha
-- overview utilizável pra essa seção ser gerada — quando não tem, o
-- recap ainda é gerado (as outras 2 seções), só que sem "onde terminou",
-- nunca inferido.
--
-- `ai_provider` e `prompt_version` existem por dois motivos diferentes:
-- auditoria de qual provedor gerou cada linha (útil ao trocar de Gemini
-- pra outro depois, via a interface `AiProvider`) e permitir forçar
-- regeneração de recaps antigos quando o PROMPT for melhorado — sem
-- isso, só `source_hash` invalidaria o cache, e ele só muda se o TMDB
-- mudar o overview (não cobre "melhoramos a instrução que mandamos pra
-- IA").
--
-- `source_hash` guarda o hash dos overviews realmente usados na
-- geração — serve pra AUDITORIA/debug (confirmar depois com que dado
-- de entrada aquele recap foi gerado). IMPORTANTE (limitação conhecida,
-- documentada de propósito, não escondida): não é comparado
-- automaticamente a cada leitura — fazer isso exigiria buscar no TMDB
-- antes de toda leitura de cache, o que anularia o propósito do cache
-- de evitar essa chamada. Se o TMDB atualizar o overview de um episódio
-- depois do recap já gerado, esta linha não se auto-invalida; precisaria
-- de uma regeneração manual (apagar a linha) até existir uma rotina
-- própria pra isso.
create table public.season_recaps (
  tmdb_id integer not null,
  season_number integer not null,
  language text not null default 'pt-BR',
  in_thirty_seconds text not null,
  key_events text not null,
  where_it_ended text,
  source_hash text not null,
  episode_coverage numeric not null,
  ai_provider text not null,
  prompt_version integer not null,
  generated_at timestamptz not null default now(),
  primary key (tmdb_id, season_number, language)
);

alter table public.season_recaps enable row level security;
-- Sem nenhuma policy, de propósito — só a chave de serviço (servidor)
-- lê/escreve, igual media_summaries_cache.
