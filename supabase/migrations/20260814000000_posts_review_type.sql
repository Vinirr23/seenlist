-- =====================================================================
-- TASK-078 — "review como post": ao avaliar uma série/filme, a
-- pessoa pode publicar essa mesma avaliação também no Feed — não é
-- um post de texto comum, é um cartão com capa do título + nota +
-- texto, então precisa de colunas próprias (não dá pra encaixar num
-- `body`/`image_url` normais sem perder a distinção visual).
--
-- Snapshot, não referência: `media_title`/`media_poster_path` são
-- copiados no momento da publicação, não buscados de novo no TMDB
-- toda vez que o post é exibido — mesmo raciocínio de
-- `favorite_character_name` (TASK-067): mais barato, e o post
-- continua mostrando a capa certa mesmo que o TMDB mude o pôster do
-- título depois.
-- =====================================================================

alter table public.posts add column if not exists media_type text;
alter table public.posts add column if not exists media_id integer;
alter table public.posts add column if not exists media_title text;
alter table public.posts add column if not exists media_poster_path text;
alter table public.posts add column if not exists rating numeric(3, 1);

do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'public.posts'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%type%'
  loop
    execute format('alter table public.posts drop constraint %I', con.conname);
  end loop;
end $$;

alter table public.posts add constraint posts_type_check check (type in ('text', 'image', 'review'));
