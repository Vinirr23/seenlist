-- =====================================================================
-- TASK-128 (correção — apagar post/comentário falhando com 42501,
-- mesmo sendo do dono) — causa raiz encontrada via Postgres Logs
-- (não era bug de código nem política errada): o RETURNING de um
-- UPDATE feito pelo PostgREST (usado internamente pra contar linhas
-- afetadas, mesmo sem o cliente pedir os dados de volta) TAMBÉM
-- precisa passar pela política de SELECT da tabela, não só pela de
-- UPDATE. Como a política de SELECT de `posts`/`post_comments`/
-- `comments` exige "deleted_at IS NULL", o apagar (que seta
-- deleted_at) fazia a linha deixar de ser "visível" no exato
-- instante da própria operação — mesmo sendo o dono, mesmo a
-- política de UPDATE estando certa.
--
-- Correção: uma política de SELECT A MAIS, só pro dono, sem essa
-- exigência — ele continua "vendo" o próprio post/comentário mesmo
-- depois de apagado (só pra essa checagem interna do Postgres
-- funcionar). É somada por OR à política pública existente — ninguém
-- mais ganha visibilidade nova, só o dono, só da própria linha.
-- =====================================================================

drop policy if exists "dono vê os próprios posts mesmo depois de apagados" on public.posts;
create policy "dono vê os próprios posts mesmo depois de apagados"
  on public.posts for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "dono vê os próprios comentários de post mesmo depois de apagados" on public.post_comments;
create policy "dono vê os próprios comentários de post mesmo depois de apagados"
  on public.post_comments for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "dono vê os próprios comentários mesmo depois de apagados" on public.comments;
create policy "dono vê os próprios comentários mesmo depois de apagados"
  on public.comments for select
  to authenticated
  using (auth.uid() = user_id);

notify pgrst, 'reload schema';
