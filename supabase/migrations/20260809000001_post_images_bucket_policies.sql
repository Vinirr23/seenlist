-- =====================================================================
-- TASK-066 — bucket "post-images" pra fotos/GIFs de post (mesmo
-- padrão de "comment-images", 20260808000000: bucket + policies via
-- SQL, não manual pelo painel — INSERT é bloqueado por padrão até
-- existir uma policy liberando, mesmo com o bucket "Public").
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do nothing;

drop policy if exists "imagem de post é pública pra leitura" on storage.objects;
create policy "imagem de post é pública pra leitura"
  on storage.objects for select
  using (bucket_id = 'post-images');

drop policy if exists "usuário sobe imagem de post apenas na própria pasta" on storage.objects;
create policy "usuário sobe imagem de post apenas na própria pasta"
  on storage.objects for insert
  with check (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "usuário remove imagem de post apenas na própria pasta" on storage.objects;
create policy "usuário remove imagem de post apenas na própria pasta"
  on storage.objects for delete
  using (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);

notify pgrst, 'reload schema';
