-- SeenList — get_achievement_rarity()
--
-- NOVO (2026-10-16, a pedido — "raridade social" na tela de detalhe de
-- emblema: "só X% dos usuários têm isso") — função que calcula, pros 4
-- emblemas do piloto, a porcentagem de usuários que já desbloquearam
-- cada um. SECURITY DEFINER por necessidade real: `user_achievements`
-- tem RLS que só deixa cada usuário ler a PRÓPRIA linha (ver
-- `20261015000001_user_achievements.sql`) — uma função SECURITY
-- INVOKER nunca conseguiria contar quantos OUTROS usuários têm cada
-- emblema, só a do próprio chamador. `set search_path` fixo, mesma
-- mitigação padrão já usada em `evaluate_and_unlock_achievements`.
--
-- Total de usuários vem de `public.profiles` — mesma convenção já
-- usada em `get_observability_stats` (`20260825000000_observability_
-- stats_fix.sql`, bloco `growth`), não de `auth.users`.
--
-- DIFERENTE de `evaluate_and_unlock_achievements` (aquela só roda pro
-- PRÓPRIO usuário) — esta não recebe `p_user_id` nenhum: o resultado é
-- o mesmo pra qualquer usuário que perguntar (é uma estatística
-- agregada e pública dentro do app, não um dado pessoal), por isso é
-- `stable` (sem escrita, só leitura) em vez de `volatile`.
create or replace function public.get_achievement_rarity()
returns table(achievement_id text, unlock_percentage numeric)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    ids.achievement_id,
    case
      when total.count = 0 then 0
      else round((unlocked.count::numeric / total.count::numeric) * 100, 1)
    end as unlock_percentage
  from (values ('maratonista'), ('madrugada'), ('amante-de-filmes'), ('classicos')) as ids(achievement_id)
  cross join (select count(*) as count from public.profiles) as total
  left join lateral (
    select count(*) as count
    from public.user_achievements ua
    where ua.achievement_id = ids.achievement_id
  ) as unlocked on true;
$function$;

revoke all on function public.get_achievement_rarity() from public;
grant execute on function public.get_achievement_rarity() to authenticated;
