-- SeenList — evaluate_and_unlock_achievements(): elimina as varreduras
-- redundantes de watched_episodes (2026-11-02, pedido do usuário —
-- "reutilizar o cálculo de séries distintas assistidas" e "reutilizar
-- o cálculo de sequências de dias consecutivos").
--
-- BASE: reproduz byte-a-byte a função hoje em produção
-- (supabase/migrations/20261017000004_evaluate_and_unlock_achievements_v2.sql
-- — arquivo sem commit, mas confirmado como o estado real do banco:
-- os 4 blocos originais + os 24 novos de 2026-10-17, mesma assinatura,
-- mesma delegação a `evaluate_top_percentile_achievement`). ESTA
-- migration NÃO toca em `evaluate_top_percentile_achievement` —
-- só substitui `evaluate_and_unlock_achievements`.
--
-- O QUE MUDA (só isso, nada mais):
--   1. "Séries distintas assistidas" (`select distinct series_id from
--      watched_episodes where user_id = p_user_id and is_special =
--      false`) era recalculada 5 VEZES, idêntica, dentro da mesma
--      chamada: Drama Lover, Comédia em Dia, Explorador, Nômade, Pelo
--      Mundo. Agora é calculada 1 vez, no início da função, pra dentro
--      de `v_distinct_series_ids integer[]`; os 5 blocos passam a ler
--      `unnest(v_distinct_series_ids)` em vez de reconsultar a tabela.
--      Resultado: mesmo conjunto de series_id (DISTINCT não garante
--      ordem, mas nenhum dos 5 blocos depende de ordem — todos usam
--      JOIN ou agregação sobre o conjunto).
--   2. "Maior sequência de dias locais consecutivos com episódio" (a
--      técnica de "ilhas") era recalculada 2 VEZES, idêntica, mudando
--      só o limiar na cláusula HAVING: Semana Ativa (>=7) e
--      Consistente (>=30). Agora o TAMANHO MÁXIMO de ilha é calculado
--      1 vez, pra dentro de `v_max_consecutive_days integer`; os 2
--      blocos passam a comparar esse número direto com o limiar de
--      cada um. Equivalência: "existe uma ilha com tamanho >= N" é
--      exatamente o mesmo que "o tamanho MÁXIMO entre todas as ilhas
--      é >= N" — nenhuma mudança de resultado possível.
--
-- Todos os OUTROS 26 blocos (os 4 originais + os 22 novos restantes)
-- são copiados SEM NENHUMA alteração — mesmas condições, mesmas
-- métricas, mesmos limiares, mesma ordem de execução.
--
-- Validação: ver script de comparação antes/depois em ambiente de
-- teste (gerado junto com esta migration, roda só SELECT — não grava
-- nenhuma conquista real durante a validação).
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
  v_distinct_series_ids integer[];
  v_max_consecutive_days integer;
begin
  select coalesce(array_agg(achievement_id), array[]::text[])
    into v_already
    from public.user_achievements
    where user_id = p_user_id;

  -- Pré-cálculo 1/2: séries distintas assistidas (reaproveitado por
  -- Drama Lover, Comédia em Dia, Explorador, Nômade e Pelo Mundo —
  -- mesmo filtro `is_special = false` que os 5 blocos já usavam).
  select coalesce(array_agg(series_id), array[]::integer[])
    into v_distinct_series_ids
    from (
      select distinct series_id
      from public.watched_episodes
      where user_id = p_user_id and is_special = false
    ) s;

  -- Pré-cálculo 2/2: maior sequência de dias locais CONSECUTIVOS com
  -- pelo menos 1 episódio (técnica de "ilhas", idêntica à usada antes
  -- em Semana Ativa e Consistente — só o limiar de comparação muda
  -- entre os dois, não o cálculo).
  select coalesce(max(island_size), 0)
    into v_max_consecutive_days
    from (
      select count(*) as island_size
      from (
        select local_day,
          local_day - ((row_number() over (order by local_day))::integer * interval '1 day') as island
        from (
          select distinct date_trunc(
                   'day',
                   (watched_at at time zone 'UTC') - (p_utc_offset_minutes || ' minutes')::interval
                 ) as local_day
          from public.watched_episodes
          where user_id = p_user_id and is_special = false
        ) distinct_days
      ) islands
      group by island
    ) sizes;

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

  -- Madrugada: 1 episódio assistido entre 2h e 5h, hora local.
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
  -- usuário já assistiu.
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

  -- =====================================================================
  -- OS 24 NOVOS (2026-10-17) — comportamento idêntico ao de produção,
  -- exceto os 7 blocos marcados abaixo (reaproveitam os pré-cálculos).
  -- =====================================================================

  -- Primeiro Passo: 1 episódio ou filme assistido, na vida.
  if not ('primeiro-passo' = any(v_already)) then
    select exists (
      select 1 from public.watched_episodes where user_id = p_user_id and is_special = false
      union all
      select 1 from public.movie_status where user_id = p_user_id and status = 'watched'
    )
    into v_qualifies;

    if v_qualifies then
      insert into public.user_achievements (user_id, achievement_id)
      values (p_user_id, 'primeiro-passo')
      on conflict (user_id, achievement_id) do nothing;
      v_newly_unlocked := array_append(v_newly_unlocked, 'primeiro-passo');
    end if;
  end if;

  -- Temporada Concluída: 1 temporada inteira (todos os episódios
  -- lançados) assistida.
  if not ('temporada-concluida' = any(v_already)) then
    select exists (
      select 1
      from public.series_season_episode_counts sc
      join (
        select series_id, season_number, count(distinct episode_number) as watched_count
        from public.watched_episodes
        where user_id = p_user_id and is_special = false
        group by series_id, season_number
      ) w on w.series_id = sc.series_id and w.season_number = sc.season_number
      where w.watched_count >= sc.episode_count
        and sc.episode_count > 0
    )
    into v_qualifies;

    if v_qualifies then
      insert into public.user_achievements (user_id, achievement_id)
      values (p_user_id, 'temporada-concluida')
      on conflict (user_id, achievement_id) do nothing;
      v_newly_unlocked := array_append(v_newly_unlocked, 'temporada-concluida');
    end if;
  end if;

  -- Avaliador: 10 reviews de títulos DISTINTOS.
  if not ('avaliador' = any(v_already)) then
    select count(distinct (media_type, media_id)) >= 10
      into v_qualifies
      from public.reviews
      where user_id = p_user_id;

    if v_qualifies then
      insert into public.user_achievements (user_id, achievement_id)
      values (p_user_id, 'avaliador')
      on conflict (user_id, achievement_id) do nothing;
      v_newly_unlocked := array_append(v_newly_unlocked, 'avaliador');
    end if;
  end if;

  -- Comentarista: 25 comentários válidos.
  if not ('comentarista' = any(v_already)) then
    select (
      (select count(*) from public.comments where user_id = p_user_id and deleted_at is null)
      + (select count(*) from public.post_comments where user_id = p_user_id and deleted_at is null)
    ) >= 25
    into v_qualifies;

    if v_qualifies then
      insert into public.user_achievements (user_id, achievement_id)
      values (p_user_id, 'comentarista')
      on conflict (user_id, achievement_id) do nothing;
      v_newly_unlocked := array_append(v_newly_unlocked, 'comentarista');
    end if;
  end if;

  -- Social: seguir 10 usuários distintos.
  if not ('social' = any(v_already)) then
    select count(*) >= 10
      into v_qualifies
      from public.follows
      where follower_id = p_user_id;

    if v_qualifies then
      insert into public.user_achievements (user_id, achievement_id)
      values (p_user_id, 'social')
      on conflict (user_id, achievement_id) do nothing;
      v_newly_unlocked := array_append(v_newly_unlocked, 'social');
    end if;
  end if;

  -- Favoritou: 20 favoritos.
  if not ('favoritou' = any(v_already)) then
    select count(*) >= 20
      into v_qualifies
      from public.favorites
      where user_id = p_user_id;

    if v_qualifies then
      insert into public.user_achievements (user_id, achievement_id)
      values (p_user_id, 'favoritou')
      on conflict (user_id, achievement_id) do nothing;
      v_newly_unlocked := array_append(v_newly_unlocked, 'favoritou');
    end if;
  end if;

  -- Centenário / Cinetrão: mesma métrica, dois marcos (100 / 500).
  declare
    v_movies_watched_count integer;
  begin
    select count(*) into v_movies_watched_count
      from public.movie_status
      where user_id = p_user_id and status = 'watched';

    if not ('centenario' = any(v_already)) and v_movies_watched_count >= 100 then
      insert into public.user_achievements (user_id, achievement_id)
      values (p_user_id, 'centenario')
      on conflict (user_id, achievement_id) do nothing;
      v_newly_unlocked := array_append(v_newly_unlocked, 'centenario');
    end if;

    if not ('cinetrao' = any(v_already)) and v_movies_watched_count >= 500 then
      insert into public.user_achievements (user_id, achievement_id)
      values (p_user_id, 'cinetrao')
      on conflict (user_id, achievement_id) do nothing;
      v_newly_unlocked := array_append(v_newly_unlocked, 'cinetrao');
    end if;
  end;

  -- Finalista: 10 séries distintas concluídas.
  if not ('finalista' = any(v_already)) then
    select count(*) >= 10
      into v_qualifies
      from public.series_status
      where user_id = p_user_id and status = 'completed';

    if v_qualifies then
      insert into public.user_achievements (user_id, achievement_id)
      values (p_user_id, 'finalista')
      on conflict (user_id, achievement_id) do nothing;
      v_newly_unlocked := array_append(v_newly_unlocked, 'finalista');
    end if;
  end if;

  -- Em Dia: 5 séries com status 'up_to_date' SIMULTANEAMENTE.
  if not ('em-dia' = any(v_already)) then
    select count(*) >= 5
      into v_qualifies
      from public.series_status
      where user_id = p_user_id and status = 'up_to_date';

    if v_qualifies then
      insert into public.user_achievements (user_id, achievement_id)
      values (p_user_id, 'em-dia')
      on conflict (user_id, achievement_id) do nothing;
      v_newly_unlocked := array_append(v_newly_unlocked, 'em-dia');
    end if;
  end if;

  -- Watchlist: 50 títulos distintos (filme+série) com status
  -- 'want_to_watch'.
  if not ('watchlist' = any(v_already)) then
    select count(*) >= 50
      into v_qualifies
      from (
        select 'movie' as media_type, movie_id as media_id
        from public.movie_status
        where user_id = p_user_id and status = 'want_to_watch'
        union
        select 'series', series_id
        from public.series_status
        where user_id = p_user_id and status = 'want_to_watch'
      ) w;

    if v_qualifies then
      insert into public.user_achievements (user_id, achievement_id)
      values (p_user_id, 'watchlist')
      on conflict (user_id, achievement_id) do nothing;
      v_newly_unlocked := array_append(v_newly_unlocked, 'watchlist');
    end if;
  end if;

  -- Organizado: 3 listas próprias com ≥5 itens cada.
  if not ('organizado' = any(v_already)) then
    select count(*) >= 3
      into v_qualifies
      from (
        select l.id
        from public.lists l
        join public.list_items li on li.list_id = l.id
        where l.user_id = p_user_id
        group by l.id
        having count(li.id) >= 5
      ) qualifying_lists;

    if v_qualifies then
      insert into public.user_achievements (user_id, achievement_id)
      values (p_user_id, 'organizado')
      on conflict (user_id, achievement_id) do nothing;
      v_newly_unlocked := array_append(v_newly_unlocked, 'organizado');
    end if;
  end if;

  -- Colecionador: 100 títulos distintos na Biblioteca, qualquer
  -- status ATIVO.
  if not ('colecionador' = any(v_already)) then
    select count(*) >= 100
      into v_qualifies
      from (
        select 'movie' as media_type, movie_id as media_id
        from public.movie_status
        where user_id = p_user_id
        union
        select 'series', series_id
        from public.series_status
        where user_id = p_user_id and status <> 'removed'
      ) lib;

    if v_qualifies then
      insert into public.user_achievements (user_id, achievement_id)
      values (p_user_id, 'colecionador')
      on conflict (user_id, achievement_id) do nothing;
      v_newly_unlocked := array_append(v_newly_unlocked, 'colecionador');
    end if;
  end if;

  -- Semana Ativa [OTIMIZADO]: existiu, alguma vez, uma sequência de 7
  -- dias locais CONSECUTIVOS com ≥1 episódio cada. Antes recalculava
  -- as "ilhas" do zero; agora só compara `v_max_consecutive_days`
  -- (calculado 1 vez, no início da função) com o limiar — mesmo
  -- resultado, sem reconsultar `watched_episodes`.
  if not ('semana-ativa' = any(v_already)) then
    v_qualifies := v_max_consecutive_days >= 7;

    if v_qualifies then
      insert into public.user_achievements (user_id, achievement_id)
      values (p_user_id, 'semana-ativa')
      on conflict (user_id, achievement_id) do nothing;
      v_newly_unlocked := array_append(v_newly_unlocked, 'semana-ativa');
    end if;
  end if;

  -- Consistente [OTIMIZADO]: mesma técnica de "ilhas", limiar 30 dias
  -- — mesma reutilização de `v_max_consecutive_days`.
  if not ('consistente' = any(v_already)) then
    v_qualifies := v_max_consecutive_days >= 30;

    if v_qualifies then
      insert into public.user_achievements (user_id, achievement_id)
      values (p_user_id, 'consistente')
      on conflict (user_id, achievement_id) do nothing;
      v_newly_unlocked := array_append(v_newly_unlocked, 'consistente');
    end if;
  end if;

  -- Viciado: existiu, alguma vez, uma JANELA DESLIZANTE de 7 dias
  -- corridos cuja soma de episódios bate 50.
  if not ('viciado' = any(v_already)) then
    select exists (
      select 1
      from (
        select
          sum(daily_count) over (
            order by local_day range between interval '6 days' preceding and current row
          ) as window_sum
        from (
          select date_trunc(
                   'day',
                   (watched_at at time zone 'UTC') - (p_utc_offset_minutes || ' minutes')::interval
                 ) as local_day,
                 count(*) as daily_count
          from public.watched_episodes
          where user_id = p_user_id and is_special = false
          group by local_day
        ) daily
      ) windowed
      where window_sum >= 50
    )
    into v_qualifies;

    if v_qualifies then
      insert into public.user_achievements (user_id, achievement_id)
      values (p_user_id, 'viciado')
      on conflict (user_id, achievement_id) do nothing;
      v_newly_unlocked := array_append(v_newly_unlocked, 'viciado');
    end if;
  end if;

  -- Binge Master: existiu, alguma vez, 1 dia local com ≥20 episódios.
  if not ('binge-master' = any(v_already)) then
    select exists (
      select 1
      from (
        select date_trunc(
                 'day',
                 (watched_at at time zone 'UTC') - (p_utc_offset_minutes || ' minutes')::interval
               ) as local_day
        from public.watched_episodes
        where user_id = p_user_id and is_special = false
        group by local_day
        having count(*) >= 20
      ) dias
    )
    into v_qualifies;

    if v_qualifies then
      insert into public.user_achievements (user_id, achievement_id)
      values (p_user_id, 'binge-master')
      on conflict (user_id, achievement_id) do nothing;
      v_newly_unlocked := array_append(v_newly_unlocked, 'binge-master');
    end if;
  end if;

  -- Fã Assíduo: 100 episódios DISTINTOS de UMA MESMA série.
  if not ('fa-assiduo' = any(v_already)) then
    select exists (
      select 1
      from (
        select series_id, coalesce(tmdb_episode_id::text, season_number::text || '-' || episode_number::text) as episode_key
        from public.watched_episodes
        where user_id = p_user_id and is_special = false
        group by series_id, episode_key
      ) distinct_eps
      group by series_id
      having count(*) >= 100
    )
    into v_qualifies;

    if v_qualifies then
      insert into public.user_achievements (user_id, achievement_id)
      values (p_user_id, 'fa-assiduo')
      on conflict (user_id, achievement_id) do nothing;
      v_newly_unlocked := array_append(v_newly_unlocked, 'fa-assiduo');
    end if;
  end if;

  -- Drama Lover [OTIMIZADO]: 30 títulos distintos assistidos com o
  -- gênero Drama (id TMDB 18). Antes reconsultava
  -- `distinct series_id from watched_episodes`; agora usa
  -- `unnest(v_distinct_series_ids)` — mesmo conjunto de séries.
  if not ('drama-lover' = any(v_already)) then
    select count(*) >= 30
      into v_qualifies
      from (
        select 1
        from public.movie_status ms
        join public.media_summaries_cache c on c.media_type = 'movie' and c.tmdb_id = ms.movie_id
        where ms.user_id = p_user_id and ms.status = 'watched' and 18 = any(c.genres)
        union
        select 1
        from (select unnest(v_distinct_series_ids) as series_id) we
        join public.media_summaries_cache c on c.media_type = 'series' and c.tmdb_id = we.series_id
        where 18 = any(c.genres)
      ) x;

    if v_qualifies then
      insert into public.user_achievements (user_id, achievement_id)
      values (p_user_id, 'drama-lover')
      on conflict (user_id, achievement_id) do nothing;
      v_newly_unlocked := array_append(v_newly_unlocked, 'drama-lover');
    end if;
  end if;

  -- Comédia em Dia [OTIMIZADO]: mesma lógica, gênero Comédia (id TMDB
  -- 35) — mesma reutilização de `v_distinct_series_ids`.
  if not ('comedia-em-dia' = any(v_already)) then
    select count(*) >= 30
      into v_qualifies
      from (
        select 1
        from public.movie_status ms
        join public.media_summaries_cache c on c.media_type = 'movie' and c.tmdb_id = ms.movie_id
        where ms.user_id = p_user_id and ms.status = 'watched' and 35 = any(c.genres)
        union
        select 1
        from (select unnest(v_distinct_series_ids) as series_id) we
        join public.media_summaries_cache c on c.media_type = 'series' and c.tmdb_id = we.series_id
        where 35 = any(c.genres)
      ) x;

    if v_qualifies then
      insert into public.user_achievements (user_id, achievement_id)
      values (p_user_id, 'comedia-em-dia')
      on conflict (user_id, achievement_id) do nothing;
      v_newly_unlocked := array_append(v_newly_unlocked, 'comedia-em-dia');
    end if;
  end if;

  -- Explorador [OTIMIZADO]: 10 gêneros DISTINTOS entre títulos
  -- assistidos — mesma reutilização de `v_distinct_series_ids`.
  if not ('explorador' = any(v_already)) then
    select count(distinct genre_id) >= 10
      into v_qualifies
      from (
        select unnest(c.genres) as genre_id
        from public.movie_status ms
        join public.media_summaries_cache c on c.media_type = 'movie' and c.tmdb_id = ms.movie_id
        where ms.user_id = p_user_id and ms.status = 'watched'
        union all
        select unnest(c.genres)
        from (select unnest(v_distinct_series_ids) as series_id) we
        join public.media_summaries_cache c on c.media_type = 'series' and c.tmdb_id = we.series_id
      ) g;

    if v_qualifies then
      insert into public.user_achievements (user_id, achievement_id)
      values (p_user_id, 'explorador')
      on conflict (user_id, achievement_id) do nothing;
      v_newly_unlocked := array_append(v_newly_unlocked, 'explorador');
    end if;
  end if;

  -- Nômade [OTIMIZADO]: 10 títulos distintos assistidos de ≥5 países
  -- diferentes — mesma reutilização de `v_distinct_series_ids`.
  if not ('nomade' = any(v_already)) then
    with watched_titles_nomade as (
      select ms.movie_id as media_id, c.production_countries as countries
      from public.movie_status ms
      join public.media_summaries_cache c on c.media_type = 'movie' and c.tmdb_id = ms.movie_id
      where ms.user_id = p_user_id and ms.status = 'watched'
      union
      select we.series_id, c.origin_countries
      from (select unnest(v_distinct_series_ids) as series_id) we
      join public.media_summaries_cache c on c.media_type = 'series' and c.tmdb_id = we.series_id
    )
    select
      (select count(*) from watched_titles_nomade) >= 10
      and (
        select count(distinct country)
        from watched_titles_nomade, unnest(coalesce(countries, array[]::text[])) as country
      ) >= 5
    into v_qualifies;

    if v_qualifies then
      insert into public.user_achievements (user_id, achievement_id)
      values (p_user_id, 'nomade')
      on conflict (user_id, achievement_id) do nothing;
      v_newly_unlocked := array_append(v_newly_unlocked, 'nomade');
    end if;
  end if;

  -- Pelo Mundo [OTIMIZADO]: mesma base de países do Nômade, limiar 15
  -- países — mesma reutilização de `v_distinct_series_ids`.
  if not ('pelo-mundo' = any(v_already)) then
    select count(distinct country) >= 15
      into v_qualifies
      from (
        select ms.movie_id as media_id, c.production_countries as countries
        from public.movie_status ms
        join public.media_summaries_cache c on c.media_type = 'movie' and c.tmdb_id = ms.movie_id
        where ms.user_id = p_user_id and ms.status = 'watched'
        union
        select we.series_id, c.origin_countries
        from (select unnest(v_distinct_series_ids) as series_id) we
        join public.media_summaries_cache c on c.media_type = 'series' and c.tmdb_id = we.series_id
      ) watched_titles_mundo,
      unnest(coalesce(countries, array[]::text[])) as country;

    if v_qualifies then
      insert into public.user_achievements (user_id, achievement_id)
      values (p_user_id, 'pelo-mundo')
      on conflict (user_id, achievement_id) do nothing;
      v_newly_unlocked := array_append(v_newly_unlocked, 'pelo-mundo');
    end if;
  end if;

  -- Top 1%: delega pra `evaluate_top_percentile_achievement` (função
  -- não alterada por esta migration).
  if not ('top-1-por-cento' = any(v_already)) then
    select public.evaluate_top_percentile_achievement(p_user_id) into v_qualifies;

    if v_qualifies then
      insert into public.user_achievements (user_id, achievement_id)
      values (p_user_id, 'top-1-por-cento')
      on conflict (user_id, achievement_id) do nothing;
      v_newly_unlocked := array_append(v_newly_unlocked, 'top-1-por-cento');
    end if;
  end if;

  return v_newly_unlocked;
end;
$function$;

revoke all on function public.evaluate_and_unlock_achievements(uuid, integer) from public;
grant execute on function public.evaluate_and_unlock_achievements(uuid, integer) to authenticated;
