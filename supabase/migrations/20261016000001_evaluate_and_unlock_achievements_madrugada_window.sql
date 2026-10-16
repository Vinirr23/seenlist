-- SeenList — evaluate_and_unlock_achievements(): ajuste da janela do Madrugada
--
-- MUDANÇA DE CRITÉRIO (2026-10-16, a pedido explícito — "mude o
-- critério para 02 - 05") — a versão anterior
-- (`20261015000002_evaluate_and_unlock_achievements.sql`) usava 0h–4h
-- (decisão também explícita na época: "na verdade entre 00h e 04h da
-- madrugada"). O usuário pediu agora a janela 2h–5h, hora local
-- (mesma convenção de `p_utc_offset_minutes` documentada na migration
-- anterior — sem mudança nenhuma aí). Esta migration substitui a
-- função inteira (`create or replace`) só com o critério do Madrugada
-- trocado; os outros 3 (Maratonista, Amante de Filmes, Clássicos) são
-- copiados sem alteração.
--
-- NÃO REVOGA desbloqueios já existentes — qualquer usuário que já
-- tenha o emblema Madrugada (sob a janela antiga, 0h–4h) continua com
-- ele; a tabela `user_achievements` não é tocada por esta migration.
-- Pendência explícita, ainda sem decisão: usuários que desbloquearam
-- Madrugada só por terem assistido entre 0h–2h (dentro da janela
-- antiga, fora da nova) ficam com um emblema que, sob o critério
-- ATUAL, não bateriam. Perguntei ao usuário se quer revogar esses
-- casos ou deixar como estão (grandfathering) — decisão pendente.
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

  -- Madrugada: 1 episódio assistido entre 2h e 5h, hora local — janela
  -- ATUALIZADA (ver comentário grande no topo do arquivo; era 0h–4h).
  if not ('madrugada' = any(v_already)) then
    select exists (
      select 1
      from public.watched_episodes
      where user_id = p_user_id
        and is_special = false
        and extract(
              hour from (watched_at at time zone 'UTC') - (p_utc_offset_minutes || ' minutes')::interval
            ) >= 2
        and extract(
              hour from (watched_at at time zone 'UTC') - (p_utc_offset_minutes || ' minutes')::interval
            ) < 5
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
