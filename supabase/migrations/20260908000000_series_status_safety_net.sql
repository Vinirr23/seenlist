-- SeenList — "Rede de segurança de 3 partes" pra status de série (2026-08-26)
--
-- Contexto: depois de investigar dois bugs reais (Bleach com 769
-- linhas de watched_episodes pra uma série de 366 episódios; Solo
-- Leveling com 13 linhas fantasma criadas por um upsert em lote não
-- identificado), ficou claro que precisamos de 3 coisas que HOJE não
-- existem: (a) um job automático que corrige status errado sem
-- precisar de ninguém clicar em nada; (b) um histórico de toda
-- mudança de status, pra investigar bugs futuros sem depender de o
-- usuário lembrar/rodar SQL na hora; (c) uma view que já aponta séries
-- com sinal de dado corrompido, usando as DUAS técnicas descobertas
-- nas investigações reais (contagem de linhas vs. episódios reais, e
-- timestamp idêntico entre linhas — a assinatura de um upsert em
-- lote).
--
-- Esta migration cobre (b) e (c), e a infraestrutura que (a) (a Edge
-- Function `daily-status-recalc`, entregue como arquivo separado)
-- precisa pra gravar com rastro de origem.

-- ============================================================
-- PARTE B — series_status_history (auditoria de toda mudança de status)
-- ============================================================

create table if not exists series_status_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  series_id integer not null,
  old_status text,
  new_status text not null,
  -- Origem da mudança, QUANDO disponível — só é preenchida com
  -- precisão pelos caminhos de escrita que já foram atualizados pra
  -- passar por `set_series_status_with_history` (ver PARTE A abaixo):
  -- 'auto_recalc' (recálculo individual, ao marcar/desmarcar episódio),
  -- 'admin_repair' (ferramenta administrativa), 'daily_job' (o job
  -- diário novo). Qualquer escrita que ainda não passa por ali (ex.:
  -- o recálculo em lote quando a Central de Séries abre, ou o app
  -- mobile) continua sendo capturada pelo gatilho abaixo, só que com
  -- 'unknown' — nunca fica sem registro, só sem rótulo preciso.
  source text not null default 'unknown',
  changed_at timestamptz not null default now()
);

create index if not exists series_status_history_user_series_idx
  on series_status_history (user_id, series_id, changed_at desc);

alter table series_status_history enable row level security;

-- Mesmo padrão de `media_summaries_cache` — só a chave de serviço
-- (que ignora RLS) grava aqui, via gatilho `security definer` ou a
-- função `set_series_status_with_history` abaixo. Usuário comum pode
-- LER o próprio histórico (útil se algum dia quisermos mostrar isso
-- na tela, ex.: "histórico desta série"), mas nunca grava direto.
create policy "usuário lê apenas o próprio histórico de status"
  on series_status_history for select
  using (auth.uid() = user_id);

-- ============================================================
-- PARTE A (infraestrutura) — gatilho + função que gravam o histórico
-- automaticamente em QUALQUER escrita em series_status, e uma RPC
-- opcional pra quem quiser gravar já com origem conhecida.
-- ============================================================

create or replace function log_series_status_change() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- `set_series_status_with_history` já grava o histórico ela mesma,
  -- com a origem certa — este `set_config` (escopo de TRANSAÇÃO, não
  -- vaza pra outras chamadas) avisa o gatilho pra não duplicar.
  if coalesce(current_setting('app.skip_status_history_trigger', true), 'false') = 'true' then
    return new;
  end if;

  if (TG_OP = 'INSERT') then
    insert into series_status_history (user_id, series_id, old_status, new_status, source)
    values (new.user_id, new.series_id, null, new.status, 'unknown');
  elsif (TG_OP = 'UPDATE' and old.status is distinct from new.status) then
    insert into series_status_history (user_id, series_id, old_status, new_status, source)
    values (new.user_id, new.series_id, old.status, new.status, 'unknown');
  end if;

  return new;
end;
$$;

drop trigger if exists trg_log_series_status_change on series_status;
create trigger trg_log_series_status_change
  after insert or update of status on series_status
  for each row execute function log_series_status_change();

-- RPC pra gravar status COM origem conhecida, num passo só (upsert +
-- histórico, mesma transação — evita o problema de `set_config`
-- "local" não sobreviver entre chamadas separadas do PostgREST).
-- `security definer` porque o job diário e a rota admin usam a chave
-- de serviço (sem `auth.uid()`) — a checagem abaixo garante que um
-- usuário comum autenticado só consegue gravar o PRÓPRIO status,
-- exatamente como a RLS de `series_status` já garante hoje.
create or replace function set_series_status_with_history(
  p_user_id uuid,
  p_series_id integer,
  p_status text,
  p_source text default 'unknown'
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_status text;
begin
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'set_series_status_with_history: não autorizado a gravar status de outro usuário';
  end if;

  select status into v_old_status
  from series_status
  where user_id = p_user_id and series_id = p_series_id;

  perform set_config('app.skip_status_history_trigger', 'true', true);

  insert into series_status (user_id, series_id, status, updated_at)
  values (p_user_id, p_series_id, p_status, now())
  on conflict (user_id, series_id) do update
    set status = excluded.status, updated_at = excluded.updated_at;

  if v_old_status is distinct from p_status then
    insert into series_status_history (user_id, series_id, old_status, new_status, source)
    values (p_user_id, p_series_id, v_old_status, p_status, p_source);
  end if;
end;
$$;

grant execute on function set_series_status_with_history(uuid, integer, text, text) to authenticated, service_role;

-- ============================================================
-- PARTE C — view de detecção de anomalia (as duas técnicas juntas)
-- ============================================================

-- Suporta a checagem de timestamp idêntico (PARTE C) e futuras
-- consultas por (usuário, série, data) — watched_episodes já tem PK
-- (user_id, series_id, season_number, episode_number), mas nenhum
-- índice hoje cobre (user_id, series_id, watched_at) diretamente.
create index if not exists watched_episodes_user_series_watched_at_idx
  on watched_episodes (user_id, series_id, watched_at)
  where is_special = false;

create or replace view series_status_anomalies as
with episode_counts as (
  select
    we.user_id,
    we.series_id,
    count(*) as watched_row_count,
    -- Técnica nova (achado do Solo Leveling, 2026-08-26): linhas que
    -- compartilham o MESMO watched_at, até o microssegundo, dentro da
    -- mesma série/usuário — sinal de gravação em lote automática
    -- (upsert), não toque manual espalhado no tempo.
    count(*) filter (where dup.dup_count > 1) as rows_in_duplicate_timestamp_batches,
    coalesce(max(dup.dup_count), 0) as largest_duplicate_timestamp_batch
  from watched_episodes we
  left join (
    select user_id, series_id, watched_at, count(*) as dup_count
    from watched_episodes
    where is_special = false
    group by user_id, series_id, watched_at
    having count(*) > 1
  ) dup
    on dup.user_id = we.user_id
   and dup.series_id = we.series_id
   and dup.watched_at = we.watched_at
  where we.is_special = false
  group by we.user_id, we.series_id
),
-- Técnica original (achado do Bleach): contagem de linhas MUITO maior
-- que o total de episódios reais da série — usa o cache já existente
-- (`media_summaries_cache`, TTL 24h, compartilhado entre todos os
-- usuários) em vez de chamar o TMDB de dentro do banco. Best-effort:
-- só cobre séries que já passaram por essa tabela alguma vez — não é
-- garantia de cobertura total, mas não custa nada rodar (é só leitura
-- de uma tabela já existente).
cached_totals as (
  select tmdb_id, max(total_episodes) as total_episodes
  from media_summaries_cache
  where media_type = 'series' and total_episodes is not null
  group by tmdb_id
)
select
  ec.user_id,
  ec.series_id,
  ec.watched_row_count,
  ct.total_episodes as cached_total_episodes,
  (ct.total_episodes is not null and ec.watched_row_count > ct.total_episodes) as row_count_exceeds_cached_total,
  ec.rows_in_duplicate_timestamp_batches,
  ec.largest_duplicate_timestamp_batch,
  (ec.rows_in_duplicate_timestamp_batches > 0) as has_identical_timestamp_batch
from episode_counts ec
left join cached_totals ct on ct.tmdb_id = ec.series_id
where
  (ct.total_episodes is not null and ec.watched_row_count > ct.total_episodes)
  or ec.rows_in_duplicate_timestamp_batches > 0;

-- Mesmo padrão de RLS de `media_summaries_cache` — a view lê de
-- `watched_episodes`/`media_summaries_cache`, então quem consulta
-- precisa da chave de serviço (ignora RLS) pra ver a base inteira;
-- não faz sentido nenhum usuário comum consultar isso (é uma
-- ferramenta de investigação, não uma tela do produto). Nenhuma
-- policy nova necessária — o acesso já é controlado por quem tem a
-- chave de serviço.

comment on view series_status_anomalies is
  'Séries com sinal de dado corrompido em watched_episodes — contagem de linhas acima do total real (cache do TMDB) OU lote de linhas com watched_at idêntico. Ferramenta de investigação/monitoramento, consultada com a chave de serviço (admin ou o job diário) — não é lida pelo app normal.';
