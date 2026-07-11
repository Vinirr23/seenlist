-- =====================================================================
-- TASK-065 (correção) — bucket "comment-images" e as permissões dele.
-- =====================================================================
-- Mesmo padrão do bucket "avatars" (20260728000000): o bucket em si
-- não bastava (criado manualmente pelo painel, sem migration, não
-- tinha nenhuma policy de INSERT) — RLS em `storage.objects` bloqueia
-- qualquer upload por padrão até existir uma policy liberando,
-- mesmo com o bucket marcado como "Public" (isso só controla leitura,
-- não escrita). Erro reproduzido: "Não foi possível enviar a imagem
-- agora" ao tentar comentar com imagem/GIF.
--
-- Diferença em relação a "avatars": lá o path é sempre
-- `{user_id}/avatar-*` (1 arquivo "atual" por usuário, por isso tem
-- policy de UPDATE). Aqui cada comentário é um arquivo novo
-- (`{user_id}/{timestamp}.ext`, ver comment-image-upload.ts) — não
-- precisa de UPDATE, só INSERT (subir) e DELETE (a pessoa remover o
-- próprio comentário/imagem depois, mesma lógica de "só na própria
-- pasta").
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('comment-images', 'comment-images', true)
on conflict (id) do nothing;

drop policy if exists "imagem de comentário é pública pra leitura" on storage.objects;
create policy "imagem de comentário é pública pra leitura"
  on storage.objects for select
  using (bucket_id = 'comment-images');

drop policy if exists "usuário sobe imagem de comentário apenas na própria pasta" on storage.objects;
create policy "usuário sobe imagem de comentário apenas na própria pasta"
  on storage.objects for insert
  with check (bucket_id = 'comment-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "usuário remove imagem de comentário apenas na própria pasta" on storage.objects;
create policy "usuário remove imagem de comentário apenas na própria pasta"
  on storage.objects for delete
  using (bucket_id = 'comment-images' and (storage.foldername(name))[1] = auth.uid()::text);

notify pgrst, 'reload schema';
