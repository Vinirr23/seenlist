-- =====================================================================
-- TASK-075 — editar/deletar post (Feed). A tabela `posts` foi criada
-- fora de uma migration rastreada neste repositório (mesma situação
-- de `post_comments`, ver 20260807000000) — não dá pra saber com
-- certeza se já existia policy de UPDATE cobrindo "só o dono edita/
-- apaga o próprio post". Esta migration garante isso de qualquer
-- forma: derruba qualquer policy de UPDATE com esse nome (se já
-- existir) e recria do zero. "Deletar" aqui é soft-delete
-- (`deleted_at`), não um DELETE de verdade — mesmo padrão já usado
-- em comments/reviews — por isso só precisa de policy de UPDATE,
-- nenhuma de DELETE.
-- =====================================================================

drop policy if exists "usuário edita ou apaga (soft-delete) apenas o próprio post" on public.posts;
create policy "usuário edita ou apaga (soft-delete) apenas o próprio post"
  on public.posts for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
