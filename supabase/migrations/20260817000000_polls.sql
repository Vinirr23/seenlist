-- =====================================================================
-- TASK-163 — enquete (poll) como tipo de post, mobile-only por ora.
--
-- Decisões confirmadas com o usuário antes de escrever isto:
--   - Voto é DEFINITIVO (sem trocar depois de votar) — por isso
--     `poll_votes` não ganha policy de UPDATE nem DELETE, só INSERT.
--     A constraint `unique (post_id, user_id)` garante isso no banco
--     também, não só na UI (segunda tentativa de voto quebra por
--     violação de unicidade — mesmo tratamento de "já denunciei antes"
--     em post_reports).
--   - Resultado (%) só aparece pra quem já votou — isso é decisão de
--     UI/client (o app só busca/mostra `poll_votes` depois que o
--     usuário votou), não dá pra fazer valer via RLS sem esconder a
--     própria pergunta de quem não votou ainda, o que não faz sentido.
--     A policy de SELECT abaixo é pública de propósito, mesmo padrão
--     de `likes` (comentário na migration de social_layer_complete).
--   - Sem data de expiração nesta primeira versão (pode virar TASK
--     futura se for pedido).
--   - Enquete de escolha única (1 opção por voto) — se um dia precisar
--     de múltipla escolha, é outra constraint em `poll_votes`, não
--     mexe no resto.
--
-- Pergunta da enquete reaproveita a coluna `body` que já existe em
-- `posts` (mesmo raciocínio de `media_title` etc. — evita coluna nova
-- pra guardar texto que já tem lugar) — a constraint
-- `posts_body_or_image_check` (20260809000000) já exige `body`
-- preenchido quando não há imagem, o que cobre enquete automaticamente
-- (toda enquete tem pergunta, nunca imagem).
--
-- Mesmo raciocínio defensivo de 20260809000000/20260814000000: a
-- constraint de `type` só é conhecida em produção, não numa migration
-- rastreada — por isso o bloco abaixo acha e derruba pelo NOME REAL
-- (via pg_constraint) em vez de arriscar um `drop constraint if
-- exists <chute>`.
-- =====================================================================

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

alter table public.posts add constraint posts_type_check check (type in ('text', 'image', 'review', 'poll'));

-- =====================================================================
-- poll_options — as alternativas da enquete, criadas junto com o post
-- (nunca editadas depois; sem policy de UPDATE de propósito).
-- =====================================================================
create table if not exists public.poll_options (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  option_text text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists poll_options_post_idx on public.poll_options (post_id);

alter table public.poll_options enable row level security;

drop policy if exists "opções de enquete são públicas" on public.poll_options;
create policy "opções de enquete são públicas"
  on public.poll_options for select
  using (true);

drop policy if exists "usuário cria opções apenas no próprio post" on public.poll_options;
create policy "usuário cria opções apenas no próprio post"
  on public.poll_options for insert
  to authenticated
  with check (
    exists (select 1 from public.posts where posts.id = post_id and posts.user_id = auth.uid())
  );

-- =====================================================================
-- poll_votes — um voto por pessoa por enquete, definitivo (só INSERT).
-- =====================================================================
create table if not exists public.poll_votes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  option_id uuid not null references public.poll_options (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create index if not exists poll_votes_post_idx on public.poll_votes (post_id);
create index if not exists poll_votes_option_idx on public.poll_votes (option_id);

alter table public.poll_votes enable row level security;

drop policy if exists "votos de enquete são públicos" on public.poll_votes;
create policy "votos de enquete são públicos"
  on public.poll_votes for select
  using (true);

drop policy if exists "usuário vota apenas em nome próprio" on public.poll_votes;
create policy "usuário vota apenas em nome próprio"
  on public.poll_votes for insert
  to authenticated
  with check (auth.uid() = user_id);

comment on table public.poll_votes is
  'Voto definitivo por design (TASK-163): sem policy de UPDATE/DELETE. A constraint unique(post_id, user_id) barra segunda tentativa de voto no banco, não só na UI.';

notify pgrst, 'reload schema';
