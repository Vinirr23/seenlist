-- SeenList — series_status: trava contra corrida entre recálculos
-- automáticos concorrentes ("Tomb Raider King fantasma no Continue
-- assistindo", 2026-09-10)
--
-- CAUSA RAIZ (confirmada por investigação de código nos dois apps,
-- web e mobile): toda vez que um episódio é marcado como assistido,
-- o app dispara NA HORA um recálculo do status da série (decide se
-- ela virou "up_to_date"). Marcar vários episódios em sequência
-- rápida dispara uma chamada de recálculo POR TOQUE, cada uma
-- concorrente, sem nenhuma trava entre elas. Como cada uma faz sua
-- própria ida à rede (TMDB) com tempo variável, uma chamada mais
-- ANTIGA (disparada por um toque anterior, mas que demorou mais pra
-- responder) pode terminar DEPOIS de uma mais NOVA e sobrescrever o
-- resultado certo com um resultado calculado a partir de dados já
-- desatualizados no momento em que rodou.
--
-- SOLUÇÃO — "instante da leitura" (`status_computed_at`): toda
-- gravação AUTOMÁTICA (recálculo) passa a informar o instante em que
-- leu os dados que embasaram sua decisão. Uma gravação automática só
-- é aceita se ninguém MAIS RECENTE já tiver mexido na linha desde
-- então — comparando contra `updated_at` (não só contra o
-- `status_computed_at` anterior), pra também proteger contra a
-- corrida com uma ação EXPLÍCITA da pessoa (ex.: marcar "assistir
-- depois" na mão) que aconteça enquanto um recálculo antigo ainda
-- está a caminho. Gravações explícitas (a pessoa escolhendo um
-- status na mão) sempre gravam `status_computed_at = null` —
-- sinalizando "não é uma decisão calculada, não tem o que comparar"
-- — e por isso NUNCA são bloqueadas por esta trava.
--
-- O gatilho já existente (`trg_log_series_status_change`) continua
-- funcionando sem mudança nenhuma: como ele é `AFTER` e este novo é
-- `BEFORE`, quando uma gravação é rejeitada aqui ele já vê
-- `old.status = new.status` (porque este gatilho já reverteu os
-- valores antes dele rodar) e corretamente não grava nenhuma linha
-- de histórico pra uma mudança que, na prática, nunca aconteceu.

alter table public.series_status
  add column if not exists status_computed_at timestamptz;

comment on column public.series_status.status_computed_at is
  'Só preenchido por gravações AUTOMÁTICAS (recálculo de categoria): o instante em que a leitura que embasou esta decisão foi feita. Gravações manuais/explícitas sempre gravam null aqui. Usado só pela trava de corrida (trg_guard_series_status_recalc_race) — nunca lido pelo app pra decidir nada visualmente.';

create or replace function public.guard_series_status_recalc_race()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- Só entra em cena quando a gravação se declara "calculada"
  -- (`status_computed_at` presente). Gravação manual/explícita passa
  -- sempre `null` aqui — nunca cai nesta checagem.
  if new.status_computed_at is not null and new.status_computed_at < old.updated_at then
    -- A leitura que embasou esta decisão já era mais velha que a
    -- última mudança de verdade na linha (outro recálculo mais novo,
    -- ou uma ação manual da pessoa) — descarta silenciosamente,
    -- mantendo a linha exatamente como estava.
    new.status := old.status;
    new.status_computed_at := old.status_computed_at;
    new.updated_at := old.updated_at;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_guard_series_status_recalc_race on public.series_status;

create trigger trg_guard_series_status_recalc_race
  before update of status on public.series_status
  for each row
  execute function public.guard_series_status_recalc_race();

-- `set_series_status_with_history` ganha um novo parâmetro opcional
-- (`p_status_computed_at`, default null — quem não passar continua
-- funcionando exatamente igual, sempre "vence"). E corrige uma
-- consequência direta da trava nova: antes, esta função decidia se
-- gravava histórico comparando `v_old_status` (lido ANTES da
-- gravação) contra `p_status` (o que foi PEDIDO pra gravar) — se a
-- trava acima rejeitar silenciosamente a gravação, `p_status` não é
-- mais o que realmente ficou salvo, e gravar histórico assim
-- registraria uma mudança que na prática não aconteceu. Agora relê o
-- status DEPOIS de gravar e compara contra o que realmente ficou.
create or replace function public.set_series_status_with_history(
  p_user_id uuid,
  p_series_id integer,
  p_status text,
  p_source text default 'unknown'::text,
  p_status_computed_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_old_status text;
  v_new_status text;
begin
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'set_series_status_with_history: não autorizado a gravar status de outro usuário';
  end if;

  select status into v_old_status
  from series_status
  where user_id = p_user_id and series_id = p_series_id;

  perform set_config('app.skip_status_history_trigger', 'true', true);

  insert into series_status (user_id, series_id, status, status_computed_at, updated_at)
  values (p_user_id, p_series_id, p_status, p_status_computed_at, now())
  on conflict (user_id, series_id) do update
    set status = excluded.status,
        status_computed_at = excluded.status_computed_at,
        updated_at = excluded.updated_at;

  select status into v_new_status
  from series_status
  where user_id = p_user_id and series_id = p_series_id;

  if v_old_status is distinct from v_new_status then
    insert into series_status_history (user_id, series_id, old_status, new_status, source)
    values (p_user_id, p_series_id, v_old_status, v_new_status, p_source);
  end if;
end;
$function$;

notify pgrst, 'reload schema';
