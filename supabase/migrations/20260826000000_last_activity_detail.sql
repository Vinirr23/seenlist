-- A PEDIDO — "Última atividade" com CONTEXTO, não só o tempo.
--
-- Antes o painel dizia apenas "há 5 min", o que confirma que existe
-- pulso mas não que o sistema está saudável: não dá pra saber se foi
-- uma ação real de uma pessoa real ou algo repetido/travado. Agora
-- devolve também QUEM fez, O QUÊ fez, e EM QUAL título.
--
-- Compara as ações mais recentes de VÁRIOS tipos (episódio,
-- avaliação, post, comentário) e devolve a mais nova entre elas — a
-- versão anterior olhava só `watched_episodes`, então uma noite
-- inteira de gente avaliando filme e postando apareceria como
-- "sem atividade".
--
-- Só substitui a chave `presence` da função; o resto é idêntico à
-- versão de 20260825000000.

create or replace function public.get_last_activity()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  with recent as (
    (
      select w.watched_at as at, w.user_id, 'episode'::text as kind, 'series'::text as media_type, w.series_id as media_id,
             ('T' || w.season_number || ' E' || w.episode_number) as detail
      from watched_episodes w
      order by w.watched_at desc
      limit 1
    )
    union all
    (
      select r.created_at, r.user_id, 'review', r.media_type, r.media_id, null
      from reviews r
      where r.deleted_at is null
      order by r.created_at desc
      limit 1
    )
    union all
    (
      select p.created_at, p.user_id, 'post', null, null, null
      from posts p
      where p.deleted_at is null
      order by p.created_at desc
      limit 1
    )
    union all
    (
      select c.created_at, c.user_id, 'comment', c.media_type, c.media_id, null
      from comments c
      where c.deleted_at is null
      order by c.created_at desc
      limit 1
    )
  ),
  latest as (
    select * from recent order by at desc limit 1
  )
  select jsonb_build_object(
    'at', l.at,
    'kind', l.kind,
    'mediaType', l.media_type,
    'mediaId', l.media_id,
    'detail', l.detail,
    'username', pr.username
  )
  into result
  from latest l
  left join profiles pr on pr.user_id = l.user_id;

  return coalesce(result, '{}'::jsonb);
end;
$$;

revoke all on function public.get_last_activity() from public;
revoke all on function public.get_last_activity() from anon;
revoke all on function public.get_last_activity() from authenticated;
