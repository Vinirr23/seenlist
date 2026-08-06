-- A PEDIDO — as duas perguntas que decidem onde investir as próximas
-- semanas, dado o quadro real do painel (D1 10%, D7 8%, mas ativação
-- boa: 59% adicionam título, 58% marcam episódio).
--
-- PERGUNTA 1 — quem instalou o APP retém melhor que quem só usa o site?
-- Só 85 dos 382 usuários (22%) têm o app instalado, e só quem tem app
-- recebe aviso de episódio novo — que é o principal motivo de voltar
-- num app de série. Se o D7 de quem tem app for muito maior, o
-- gargalo é CONVERSÃO PRA MOBILE, não o produto em si — e a resposta
-- é empurrar instalação, não construir funcionalidade nova.
--
-- PERGUNTA 2 — quem IMPORTOU biblioteca retém melhor ou pior?
-- 39 mil séries e 1,18 milhão de episódios para 221 ativos significa
-- ~175 séries por pessoa: é importação em massa, não uso orgânico. A
-- hipótese a testar é que muita gente entrou só para importar e foi
-- embora. Se quem importou retém PIOR, o importador está trazendo
-- usuário errado (ou a experiência pós-importação decepciona) — e aí
-- o trabalho é no que acontece DEPOIS da importação.
--
-- Definição de "importou": mais de 50 episódios marcados na primeira
-- hora de conta. Ninguém assiste isso manualmente nesse tempo — é o
-- melhor sinal disponível, já que não existe tabela registrando
-- importações (pendência conhecida do plano de monitoramento).

create or replace function public.get_retention_cohorts()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  with base as (
    select
      p.user_id,
      p.created_at,
      -- Tem o app instalado? (token de push só existe pra quem
      -- instalou E permitiu notificação — é um piso, não o total.)
      exists (select 1 from push_tokens t where t.user_id = p.user_id) as has_app,
      -- Importou? (rajada de episódios na primeira hora)
      (
        select count(*)
        from watched_episodes w
        where w.user_id = p.user_id
          and w.watched_at < p.created_at + interval '1 hour'
      ) > 50 as imported,
      -- Voltou no dia seguinte?
      exists (
        select 1 from watched_episodes w
        where w.user_id = p.user_id
          and w.watched_at >= p.created_at + interval '1 day'
          and w.watched_at <  p.created_at + interval '2 days'
      ) as retained_d1,
      -- Voltou uma semana depois?
      exists (
        select 1 from watched_episodes w
        where w.user_id = p.user_id
          and w.watched_at >= p.created_at + interval '7 days'
          and w.watched_at <  p.created_at + interval '8 days'
      ) as retained_d7
    from profiles p
    -- Só coortes maduras: quem criou conta há menos de 8 dias ainda
    -- não teve chance de completar o D7 e entraria como perda injusta.
    where p.created_at < now() - interval '8 days'
      and p.created_at > now() - interval '90 days'
  )
  select jsonb_build_object(
    'withApp', jsonb_build_object(
      'total',      count(*) filter (where has_app),
      'retainedD1', count(*) filter (where has_app and retained_d1),
      'retainedD7', count(*) filter (where has_app and retained_d7)
    ),
    'webOnly', jsonb_build_object(
      'total',      count(*) filter (where not has_app),
      'retainedD1', count(*) filter (where not has_app and retained_d1),
      'retainedD7', count(*) filter (where not has_app and retained_d7)
    ),
    'imported', jsonb_build_object(
      'total',      count(*) filter (where imported),
      'retainedD1', count(*) filter (where imported and retained_d1),
      'retainedD7', count(*) filter (where imported and retained_d7)
    ),
    'notImported', jsonb_build_object(
      'total',      count(*) filter (where not imported),
      'retainedD1', count(*) filter (where not imported and retained_d1),
      'retainedD7', count(*) filter (where not imported and retained_d7)
    )
  )
  into result
  from base;

  return result;
end;
$$;

revoke all on function public.get_retention_cohorts() from public;
revoke all on function public.get_retention_cohorts() from anon;
revoke all on function public.get_retention_cohorts() from authenticated;
