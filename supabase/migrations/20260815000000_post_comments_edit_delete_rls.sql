-- =====================================================================
-- TASK-126 (correção — apagar comentário do Feed) — a tabela
-- `post_comments` nunca teve uma migration rastreada neste
-- repositório pra política de UPDATE (mesma situação que `posts`
-- tinha antes de 20260812000000 — criada fora do controle de
-- versão, direto no painel do Supabase). Isso explica o comentário
-- do Feed nunca ter conseguido ser apagado: a política que permite
-- ao dono editar/apagar (soft-delete) o próprio comentário
-- provavelmente nunca existiu de verdade no banco.
-- =====================================================================

drop policy if exists "usuário edita ou apaga (soft-delete) apenas o próprio comentário de post" on public.post_comments;
create policy "usuário edita ou apaga (soft-delete) apenas o próprio comentário de post"
  on public.post_comments for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
