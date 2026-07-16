-- =====================================================================
-- TASK-164 (auditoria) — a correção de TASK-128
-- (20260816000000_owner_select_for_soft_deleted_rows.sql: "RETURNING
-- de UPDATE também passa pela política de SELECT") foi aplicada em
-- `posts`, `post_comments` e `comments`, mas `reviews` ficou de fora
-- — mesmo tendo soft-delete (`deleted_at`) e a mesma policy de
-- SELECT exigindo `deleted_at is null` (20260731000000, linha ~104).
-- Achado via auditoria de código, não relato de bug — apagar uma
-- review deve estar falhando com 42501 hoje, mesmo pro dono, pelo
-- mesmo motivo já documentado em TASK-128.
-- =====================================================================

drop policy if exists "dono vê as próprias reviews mesmo depois de apagadas" on public.reviews;
create policy "dono vê as próprias reviews mesmo depois de apagadas"
  on public.reviews for select
  to authenticated
  using (auth.uid() = user_id);

notify pgrst, 'reload schema';
