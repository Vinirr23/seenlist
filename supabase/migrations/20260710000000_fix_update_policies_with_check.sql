-- SeenList — corrige policies de UPDATE sem WITH CHECK
--
-- Bug de segurança encontrado no MVP Review (TASK-010): as policies
-- de UPDATE de `movie_status` e `series_status` só tinham `USING`
-- (que valida a linha ANTES do update), sem `WITH CHECK` (que valida
-- a linha DEPOIS). Sem isso, um usuário autenticado poderia, em
-- teoria, dar um UPDATE que trocasse o `user_id` da própria linha
-- para outro usuário — o app nunca faz isso pela UI (o update só
-- manda `status`/`updated_at`), mas nada no banco impedia uma
-- requisição direta à API do Supabase de tentar. RLS não se apoia em
-- "o app não deixa" — tem que valer no banco.

alter policy "usuário atualiza apenas o próprio status"
  on public.movie_status
  with check (auth.uid() = user_id);

alter policy "usuário atualiza apenas o próprio status"
  on public.series_status
  with check (auth.uid() = user_id);
