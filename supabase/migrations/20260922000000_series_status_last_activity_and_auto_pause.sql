-- SeenList — series_status.last_activity_at (coluna real) + suporte
-- ao auto-pause silencioso de séries inativas há 30+ dias (2026-09-22)
--
-- CONTEXTO — bug reportado com prints: o hero "Tudo em dia!" aparecia
-- mesmo com séries pendentes na seção "Faz um tempo que você não
-- assiste" (renomeada agora pra "Continue de onde parou" — ver
-- traduções). Corrigido no código (web/mobile), mas na mesma conversa
-- o usuário pediu mais uma coisa: depois de 1 mês nessa seção, a
-- série vira "Pausada" sozinha, sem aviso nenhum ("Silencioso, sem
-- aviso" — confirmado por pergunta direta).
--
-- Pra isso, o job diário (`daily-status-recalc`) precisa saber "há
-- quanto tempo essa série está sem atividade" — mas `lastActivityAt`
-- (o campo que a TELA já usa pra decidir a seção "Continue de onde
-- parou") NUNCA existiu como coluna: é calculado só no código do web
-- (`library-state.ts`), na hora de montar a resposta da API:
--   lastActivityAt = max(series_status.updated_at, watched_episodes.watched_at mais recente da série)
--
-- Decisão explícita do usuário (pergunta direta, duas opções: calcular
-- de novo dentro do job SEM mexer no banco, ou criar uma coluna real
-- mantida por trigger) — escolhida a coluna real: mais robusta a
-- longo prazo, e deixa o job diário só LER, sem precisar replicar essa
-- fórmula pela quarta vez (já existe em web, mobile E neste próprio
-- arquivo — ver aviso grande no topo de `daily-status-recalc/index.ts`
-- sobre a lógica de categoria; esta é uma fórmula DIFERENTE, mas mesmo
-- risco de duplicação se fosse replicada de novo aqui).
--
-- A coluna é só mais uma fonte de verdade PRA ESTE JOB — não muda o
-- que a tela já faz hoje (web/mobile continuam calculando o próprio
-- `lastActivityAt` do jeito que já funciona, sem depender desta
-- coluna). Se um dia quisermos que a tela também leia daqui em vez de
-- calcular, é uma mudança separada, decidida à parte.

-- ============================================================
-- PARTE 1 — a coluna, com backfill
-- ============================================================

alter table public.series_status
  add column if not exists last_activity_at timestamptz;

comment on column public.series_status.last_activity_at is
  'Espelha `LibraryItem.lastActivityAt` (calculado em `library-state.ts`): max(series_status.updated_at, watched_episodes.watched_at mais recente da série, não-especial). Mantida automaticamente por trigger (ver `bump_series_status_last_activity`/`bump_series_status_last_activity_from_watched_episode`) — nunca escrita direto pelo app. Usada pelo job `daily-status-recalc` pra decidir o auto-pause silencioso de séries "watching" sem atividade há 30+ dias.';

-- Backfill — mesma fórmula do web, calculada uma vez pra popular as
-- linhas já existentes antes do trigger assumir a partir de agora.
update public.series_status ss
set last_activity_at = greatest(
  ss.updated_at,
  coalesce(
    (
      select max(we.watched_at)
      from public.watched_episodes we
      where we.user_id = ss.user_id
        and we.series_id = ss.series_id
        and we.is_special = false
    ),
    ss.updated_at
  )
)
where last_activity_at is null;

alter table public.series_status
  alter column last_activity_at set default now(),
  alter column last_activity_at set not null;

-- Índice parcial — o job diário só precisa varrer `status = 'watching'`
-- ordenado/filtrado por `last_activity_at`; mesmo raciocínio do índice
-- parcial já criado em `watched_episodes` na migration anterior
-- (`20260908000000_series_status_safety_net.sql`).
create index if not exists series_status_watching_last_activity_idx
  on public.series_status (last_activity_at)
  where status = 'watching';

-- ============================================================
-- PARTE 2 — gatilhos que mantêm a coluna sozinha, sem o app precisar
-- saber que ela existe
-- ============================================================

-- (a) Qualquer escrita em series_status (INSERT, ou UPDATE que muda o
-- status — inclusive via `set_series_status_with_history`, usada pelo
-- job diário, pela rota admin e pelo recálculo automático de
-- "watching"/"up_to_date"/"completed") bate `last_activity_at` pra
-- agora — é a metade "updated_at" da fórmula do web.
--
-- IMPORTANTE — ORDEM DE EXECUÇÃO: precisa rodar DEPOIS do gatilho
-- `trg_guard_series_status_recalc_race` (mesma tabela, mesmo evento
-- `before update of status`) pra ver o `NEW.updated_at` já definitivo
-- (a trava de corrida pode reverter `NEW` pros valores antigos antes
-- deste rodar). Gatilhos `BEFORE` do mesmo evento disparam em ordem
-- alfabética do NOME do gatilho — "trg_guard_..." vem antes de
-- "trg_series_status_bump_..." porque 'g' < 's' — a ordem certa já
-- sai garantida pelo nome escolhido, sem precisar de nenhum mecanismo
-- extra.
create or replace function public.bump_series_status_last_activity()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if TG_OP = 'INSERT' then
    new.last_activity_at := coalesce(new.last_activity_at, new.updated_at);
  else
    new.last_activity_at := greatest(coalesce(old.last_activity_at, new.updated_at), new.updated_at);
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_series_status_bump_last_activity on public.series_status;

create trigger trg_series_status_bump_last_activity
  before insert or update of status on public.series_status
  for each row
  execute function public.bump_series_status_last_activity();

-- (b) Marcar um episódio como assistido bate `last_activity_at` da
-- série pro `watched_at` do episódio, se for mais recente — é a
-- metade "watched_episodes" da fórmula do web. Só episódios NÃO
-- especiais contam (mesmo filtro `is_special = false` já usado em
-- toda consulta de progresso/biblioteca do projeto).
--
-- Roda como `AFTER INSERT` (não `UPDATE`) de propósito — os dois
-- caminhos de escrita em lote do app (`markEpisodesWatched` no
-- mobile, o equivalente no web) usam `upsert(..., { ignoreDuplicates:
-- true })`, ou seja `ON CONFLICT DO NOTHING`: nunca disparam UPDATE
-- pra episódios que já existem, só INSERT pros novos — cobrir só
-- INSERT já cobre 100% dos casos reais de "marcar assistido" hoje.
create or replace function public.bump_series_status_last_activity_from_watched_episode()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.is_special then
    return new;
  end if;

  update public.series_status
    set last_activity_at = greatest(last_activity_at, new.watched_at)
    where user_id = new.user_id and series_id = new.series_id;

  return new;
end;
$function$;

drop trigger if exists trg_watched_episode_bump_series_status_activity on public.watched_episodes;

create trigger trg_watched_episode_bump_series_status_activity
  after insert on public.watched_episodes
  for each row
  execute function public.bump_series_status_last_activity_from_watched_episode();

notify pgrst, 'reload schema';
