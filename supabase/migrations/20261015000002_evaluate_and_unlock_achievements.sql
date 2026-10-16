-- SeenList — evaluate_and_unlock_achievements()
--
-- REAL (2026-10-15, a pedido — "Implementar o desbloqueio real dos 4
-- primeiros") — função que de fato confere os 4 critérios (lidos
-- direto de `apps/mobile/lib/i18n/translations.ts`, chaves
-- `achievements.*.requirement`) e grava em `user_achievements`
-- (migration anterior) o que for novo. Decisão explícita do usuário:
-- cálculo via função no Postgres (RPC), não em JavaScript no app.
--
-- SECURITY DEFINER, por necessidade real, não por conveniência: o
-- critério do Clássicos precisa ler `media_summaries_cache` (ano de
-- lançamento), e essa tabela foi criada DE PROPÓSITO sem nenhuma
-- policy pra usuário autenticado (só a chave de serviço do servidor
-- lê, ver `20260905000000_media_summaries_cache.sql`) — uma função
-- SECURITY INVOKER (como `get_watched_episode_stats`, que não precisa
-- disso) bateria de cara na mesma RLS e sempre veria 0 linhas ali.
-- SECURITY DEFINER também é o que permite a função escrever em
-- `user_achievements`, que de propósito não tem policy de insert pro
-- cliente. `set search_path to 'public'` fixo, igual ao padrão já
-- usado no projeto — mitigação padrão contra sequestro de search_path
-- em função SECURITY DEFINER.
--
-- FUSO HORÁRIO — Postgres não guarda o fuso do usuário, e o app NUNCA
-- usa UTC pra "que dia é hoje"/"que hora é agora" (ver
-- `apps/mobile/lib/localDate.ts`, TASK-154). Pra calcular "mesmo dia
-- local" (Maratonista) e "hora local" (Madrugada) aqui dentro, o app
-- manda `p_utc_offset_minutes`: EXATAMENTE o valor que
-- `new Date().getTimezoneOffset()` devolve no aparelho (minutos a
-- SUBTRAIR de um instante UTC pra chegar na hora de parede local —
-- positivo pra fusos atrás de UTC, como o Brasil, +180). A conta
-- `(watched_at at time zone 'UTC') - (p_utc_offset_minutes || ' minutes')::interval`
-- primeiro lê o instante timestamptz como se fosse um timestamp "cru"
-- em UTC, depois subtrai o deslocamento — o resultado é a hora de
-- parede local de quem assistiu, do jeito que apareceria no relógio
-- do aparelho dele no momento em que assistiu.
--
-- CRITÉRIO DO MADRUGADA — o texto ("depois das 3 da manhã") não
-- escreve um teto em lugar nenhum (conferido nas 3 línguas). Ao pé da
-- letra, isso bateria em qualquer episódio assistido à tarde/noite,
-- o que não combina com o nome do emblema ("Madrugada"/"Late Night").
-- Decisão explícita do usuário, perguntada direto: tratar como uma
-- janela de madrugada de verdade — hora local >= 0 (meia-noite) E < 4
-- (a redação em "depois das 3 da manhã" não é usada ao pé da letra,
-- por pedido explícito do usuário: a janela real pedida foi 0h–4h).
create or replace function public.evaluate_and_unlock_achievements(
  p_user_id uuid,
  p_utc_offset_minutes integer default 0
)
returns text[]
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_already text[];
  v_newly_unlocked text[] := array[]::text[];
  v_qualifies boolean;
begin
  select coalesce(array_agg(achievement_id), array[]::text[])
    into v_already
    from public.user_achievements
    where user_id = p_user_id;

  -- Maratonista: 10 episódios assistidos no MESMO dia local (não UTC).
  if not ('maratonista' = any(v_already)) then
    select exists (
      select 1
      from (
        select date_trunc(
                 'day',
                 (watched_at at time zone 'UTC') - (p_utc_offset_minutes || ' minutes')::interval
               ) as local_day
        from public.watched_episodes
        where user_id = p_user_id
          and is_special = false
        group by local_day
        having count(*) >= 10
      ) dias_com_maratona
    )
    into v_qualifies;

    if v_qualifies then
      insert into public.user_achievements (user_id, achievement_id)
      values (p_user_id, 'maratonista')
      on conflict (user_id, achievement_id) do nothing;
      v_newly_unlocked := array_append(v_newly_unlocked, 'maratonista');
    end if;
  end if;

  -- Madrugada: 1 episódio assistido entre 0h (meia-noite) e 4h, hora
  -- local (janela de madrugada de verdade — ver comentário grande no
  -- topo do arquivo).
  if not ('madrugada' = any(v_already)) then
    select exists (
      select 1
      from public.watched_episodes
      where user_id = p_user_id
        and is_special = false
        and extract(
              hour from (watched_at at time zone 'UTC') - (p_utc_offset_minutes || ' minutes')::interval
            ) >= 0
        and extract(
              hour from (watched_at at time zone 'UTC') - (p_utc_offset_minutes || ' minutes')::interval
            ) < 4
    )
    into v_qualifies;

    if v_qualifies then
      insert into public.user_achievements (user_id, achievement_id)
      values (p_user_id, 'madrugada')
      on conflict (user_id, achievement_id) do nothing;
      v_newly_unlocked := array_append(v_newly_unlocked, 'madrugada');
    end if;
  end if;

  -- Amante de Filmes: 10 filmes com status 'watched'.
  if not ('amante-de-filmes' = any(v_already)) then
    select count(*) >= 10
      into v_qualifies
      from public.movie_status
      where user_id = p_user_id
        and status = 'watched';

    if v_qualifies then
      insert into public.user_achievements (user_id, achievement_id)
      values (p_user_id, 'amante-de-filmes')
      on conflict (user_id, achievement_id) do nothing;
      v_newly_unlocked := array_append(v_newly_unlocked, 'amante-de-filmes');
    end if;
  end if;

  -- Clássicos: 1 título (filme OU série) lançado antes de 2000, que o
  -- usuário já assistiu (filme com status 'watched', ou série com ao
  -- menos 1 episódio assistido). O ano vem do cache compartilhado de
  -- resumos do TMDB (`media_summaries_cache.year`) — como ele é
  -- alimentado sob demanda (quando alguém abre aquele título na
  -- Biblioteca), um título assistido há muito tempo cujo cache tenha
  -- expirado/nunca existido simplesmente não é detectado NESTA
  -- chamada — não é um erro, é a mesma limitação que o cache já tem
  -- em outros usos; a próxima chamada, depois do cache repopular,
  -- detecta normalmente.
  if not ('classicos' = any(v_already)) then
    select exists (
      select 1
      from public.movie_status ms
      join public.media_summaries_cache c
        on c.media_type = 'movie' and c.tmdb_id = ms.movie_id
      where ms.user_id = p_user_id
        and ms.status = 'watched'
        and c.year is not null
        and c.year < 2000
      union all
      select 1
      from public.watched_episodes we
      join public.media_summaries_cache c
        on c.media_type = 'series' and c.tmdb_id = we.series_id
      where we.user_id = p_user_id
        and we.is_special = false
        and c.year is not null
        and c.year < 2000
    )
    into v_qualifies;

    if v_qualifies then
      insert into public.user_achievements (user_id, achievement_id)
      values (p_user_id, 'classicos')
      on conflict (user_id, achievement_id) do nothing;
      v_newly_unlocked := array_append(v_newly_unlocked, 'classicos');
    end if;
  end if;

  return v_newly_unlocked;
end;
$function$;

revoke all on function public.evaluate_and_unlock_achievements(uuid, integer) from public;
grant execute on function public.evaluate_and_unlock_achievements(uuid, integer) to authenticated;
