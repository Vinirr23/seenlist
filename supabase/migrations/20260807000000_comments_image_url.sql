-- =====================================================================
-- TASK-065 — comentários (série/filme/temporada/episódio) com imagem
-- ou GIF, além de texto.
-- =====================================================================
-- `image_url` guarda o link público do arquivo (bucket de Storage
-- "comment-images", criado à parte no painel do Supabase — mesmo
-- padrão de "avatars"/"banners", que também não têm migration
-- própria neste projeto). Um GIF é só um arquivo de imagem animado —
-- não precisa de coluna nem lógica separada, o mesmo campo serve
-- pros dois.
--
-- A constraint original exigia `body` sempre preenchido (1-2000
-- caracteres). Agora um comentário é válido se tiver TEXTO ou
-- IMAGEM (ou os dois) — só os dois vazios ao mesmo tempo que
-- continua inválido. `body` precisou virar nullable pra isso ser
-- possível (não dá pra ter uma imagem sem legenda com a coluna
-- `not null` de antes).
-- =====================================================================

alter table public.comments add column if not exists image_url text;

alter table public.comments alter column body drop not null;

alter table public.comments drop constraint if exists comments_body_check;

alter table public.comments add constraint comments_body_or_image_check check (
  (body is not null and char_length(body) between 1 and 2000) or (image_url is not null)
);
