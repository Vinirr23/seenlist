-- SeenList — get_movie_added_count
--
-- A PEDIDO (redesenho da tela de Filme, mockup aprovado 2026-09-25)
-- — "Este filme foi adicionado por X usuário(s)" precisa do total
-- REAL de usuários, não só do que a RLS de `movie_status` deixa o
-- usuário logado enxergar (dono da linha + bibliotecas
-- públicas/seguidos — ver `20260728000000_social_layer_complete.sql`,
-- seção 8). Perguntado ao usuário explicitamente (número real vs. só
-- o que é visível) — escolheu número real.
--
-- Mesmo padrão de `get_year_activity_percentile` (20260821000000):
-- `security definer` roda com privilégio elevado, mas só DEVOLVE um
-- número agregado — nunca uma linha, nunca quem são os usuários.

create or replace function public.get_movie_added_count(p_movie_id integer)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::integer from public.movie_status where movie_id = p_movie_id
$$;

-- Qualquer usuário autenticado pode chamar — a função em si só
-- devolve UM número (contagem agregada), nunca dado de outra pessoa.
grant execute on function public.get_movie_added_count(integer) to authenticated;
