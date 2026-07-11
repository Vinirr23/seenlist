-- =====================================================================
-- TASK-066 — novo tipo de post: imagem/GIF (post com foto, com ou
-- sem legenda).
-- =====================================================================
-- Mesmo raciocínio de 20260807000000 (comentários com imagem): a
-- constraint de `type` original só foi vista em produção, não existe
-- migration rastreada no repo pra ela (aplicada fora do controle de
-- versão, ver SEENLIST-HANDOFF.md) — por isso o bloco abaixo
-- encontra e derruba a constraint pelo NOME REAL dela (via
-- `pg_constraint`), em vez de arriscar um nome errado com
-- `drop constraint if exists <chute>`, que simplesmente não faria
-- nada silenciosamente se o nome estivesse errado.
--
-- `body` também precisa virar opcional aqui pela mesma razão do
-- comentário com imagem: uma foto sem legenda é um post válido.
-- =====================================================================

alter table public.posts add column if not exists image_url text;

alter table public.posts alter column body drop not null;

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

alter table public.posts add constraint posts_type_check check (type in ('text', 'image'));

alter table public.posts drop constraint if exists posts_body_check;
alter table public.posts add constraint posts_body_or_image_check check (
  (body is not null and char_length(body) > 0) or (image_url is not null)
);
