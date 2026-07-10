-- TASK-027L (correção) — watched_episodes nunca teve policy de
-- UPDATE porque o importador antigo sempre gravava com
-- `ignoreDuplicates: true` (INSERT ... ON CONFLICT DO NOTHING, nunca
-- atualiza). O importador novo (extensão TV Time Out) faz upsert de
-- verdade — numa reimportação, quer atualizar watched_at/
-- rewatch_count/is_special de um episódio que já existe, não só
-- ignorar. Isso aciona a metade UPDATE do upsert quando há conflito,
-- e sem essa policy o Postgres rejeita com "violates row-level
-- security policy (USING expression)".

drop policy if exists "usuário atualiza apenas os próprios episódios assistidos" on public.watched_episodes;
create policy "usuário atualiza apenas os próprios episódios assistidos"
  on public.watched_episodes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
