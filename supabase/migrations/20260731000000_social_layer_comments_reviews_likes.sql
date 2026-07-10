-- =====================================================================
-- TASK-031 — Camada social genérica e reutilizável
-- =====================================================================
-- Restrição histórica ("não implementar avaliações/comentários/
-- curtidas", presente desde 20260705000000) foi revogada
-- EXPLICITAMENTE nesta tarefa. Esta migration projeta a estrutura
-- definitiva — comentários, reviews, curtidas, base pra notificações
-- e moderação futuras — de um jeito genérico o bastante pra nunca
-- precisar de uma tabela nova quando outro tipo de mídia aparecer.
--
-- Uma diferença importante em relação ao exemplo dado na tarefa:
-- trocado `episode_id` por `season_number, episode_number`. O
-- SeenList não tem (e nunca teve) uma tabela local de episódios —
-- eles só existem como dado do TMDB, buscado ao vivo, e localmente
-- só ficam registrados como (season_number, episode_number) dentro
-- de `watched_episodes`. Um `episode_id` implicaria uma tabela de
-- episódios que não existe e que esta tarefa não pede pra criar;
-- (season_number, episode_number), ambos nullable, segue exatamente
-- a mesma convenção que `watched_episodes` já usa.
-- =====================================================================

-- =====================================================================
-- 1. COMMENTS — genérica pra filme, série, temporada e episódio.
-- season_number/episode_number nulos = comentário no nível da série/
-- filme inteiro. Só season_number preenchido = comentário de
-- temporada. Os dois preenchidos = comentário de episódio.
-- =====================================================================
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  media_type text not null check (media_type in ('movie', 'series')),
  media_id integer not null,
  season_number integer,
  episode_number integer,
  parent_comment_id uuid references public.comments (id) on delete cascade,
  contains_spoiler boolean not null default false,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint comments_episode_needs_season check (episode_number is null or season_number is not null),
  constraint comments_movie_has_no_episode check (media_type <> 'movie' or (season_number is null and episode_number is null))
);

create index if not exists comments_media_idx on public.comments (media_type, media_id, season_number, episode_number, created_at desc);
create index if not exists comments_parent_idx on public.comments (parent_comment_id);
create index if not exists comments_user_idx on public.comments (user_id);

alter table public.comments enable row level security;

drop policy if exists "comentários não apagados são públicos" on public.comments;
create policy "comentários não apagados são públicos"
  on public.comments for select
  using (deleted_at is null);

drop policy if exists "usuário comenta apenas em nome próprio" on public.comments;
create policy "usuário comenta apenas em nome próprio"
  on public.comments for insert
  with check (auth.uid() = user_id);

drop policy if exists "usuário edita/apaga apenas o próprio comentário" on public.comments;
create policy "usuário edita/apaga apenas o próprio comentário"
  on public.comments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on column public.comments.deleted_at is
  'Soft delete — nunca DELETE de verdade. Preserva o histórico pra moderação futura; policy de select já filtra deleted_at is null pra todo mundo.';
comment on column public.comments.contains_spoiler is
  'Flag manual, complementar à ocultação automática por progresso (calculada na aplicação, comparando season_number/episode_number contra watched_episodes do usuário que está lendo). Continua existindo pro caso que a ocultação automática não cobre: comentário de série/temporada mencionando spoiler de episódio futuro.';

-- =====================================================================
-- 2. REVIEWS — uma por usuário por alvo (filme/série/temporada/
-- episódio). "Avaliação rápida" (só nota) e "review completa" (nota +
-- texto) são a MESMA linha — review_text nulo/vazio = avaliação
-- rápida.
-- =====================================================================
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  media_type text not null check (media_type in ('movie', 'series')),
  media_id integer not null,
  season_number integer,
  episode_number integer,
  rating numeric(3, 1) not null check (rating >= 0 and rating <= 10),
  review_text text check (review_text is null or char_length(review_text) <= 4000),
  contains_spoiler boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint reviews_episode_needs_season check (episode_number is null or season_number is not null),
  constraint reviews_movie_has_no_episode check (media_type <> 'movie' or (season_number is null and episode_number is null)),
  unique (user_id, media_type, media_id, season_number, episode_number)
);

create index if not exists reviews_media_idx on public.reviews (media_type, media_id, season_number, episode_number, created_at desc);
create index if not exists reviews_user_idx on public.reviews (user_id);

alter table public.reviews enable row level security;

drop policy if exists "reviews não apagadas são públicas" on public.reviews;
create policy "reviews não apagadas são públicas"
  on public.reviews for select
  using (deleted_at is null);

drop policy if exists "usuário avalia apenas em nome próprio" on public.reviews;
create policy "usuário avalia apenas em nome próprio"
  on public.reviews for insert
  with check (auth.uid() = user_id);

drop policy if exists "usuário edita/apaga apenas a própria review" on public.reviews;
create policy "usuário edita/apaga apenas a própria review"
  on public.reviews for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =====================================================================
-- 3. LIKES — genérica, target_type identifica o que foi curtido.
-- =====================================================================
create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  target_type text not null check (target_type in ('comment', 'review', 'list')),
  target_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, target_type, target_id)
);

create index if not exists likes_target_idx on public.likes (target_type, target_id);
create index if not exists likes_user_idx on public.likes (user_id);

alter table public.likes enable row level security;

drop policy if exists "curtidas são públicas" on public.likes;
create policy "curtidas são públicas"
  on public.likes for select
  using (true);

drop policy if exists "usuário curte apenas em nome próprio" on public.likes;
create policy "usuário curte apenas em nome próprio"
  on public.likes for insert
  with check (auth.uid() = user_id);

drop policy if exists "usuário descurte apenas a própria curtida" on public.likes;
create policy "usuário descurte apenas a própria curtida"
  on public.likes for delete
  using (auth.uid() = user_id);

comment on table public.likes is
  '"Contadores públicos" são feitos por COUNT direto nesta tabela (índice em target_type+target_id já criado acima), não por coluna denormalizada — mais simples, sem risco de dessincronizar. Migrar pra contador com trigger no futuro não quebra nada que já consome esta tabela.';

-- =====================================================================
-- 4. NOTIFICATIONS — estrutura pronta, sem UI/trigger ainda. Sem
-- policy de insert/update pra usuário comum — só leitura da própria
-- caixa. Só service_role ou função security definer futura poderia
-- inserir notificação.
-- =====================================================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  type text not null check (type in ('comment_reply', 'comment_like', 'review_like', 'new_follower')),
  target_type text check (target_type in ('comment', 'review', 'profile')),
  target_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc) where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "usuário vê apenas as próprias notificações" on public.notifications;
create policy "usuário vê apenas as próprias notificações"
  on public.notifications for select
  using (auth.uid() = user_id);

drop policy if exists "usuário marca como lida apenas a própria notificação" on public.notifications;
create policy "usuário marca como lida apenas a própria notificação"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =====================================================================
-- 5. CONTENT_REPORTS — base de moderação futura.
-- =====================================================================
create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  target_type text not null check (target_type in ('comment', 'review')),
  target_id uuid not null,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed', 'actioned')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists content_reports_status_idx on public.content_reports (status, created_at) where status = 'pending';

alter table public.content_reports enable row level security;

drop policy if exists "usuário denuncia apenas em nome próprio" on public.content_reports;
create policy "usuário denuncia apenas em nome próprio"
  on public.content_reports for insert
  with check (auth.uid() = reporter_id);

drop policy if exists "usuário vê apenas as próprias denúncias" on public.content_reports;
create policy "usuário vê apenas as próprias denúncias"
  on public.content_reports for select
  using (auth.uid() = reporter_id);

-- =====================================================================
-- 6. Realtime
-- =====================================================================
do $$
begin
  alter publication supabase_realtime add table public.comments;
exception
  when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.likes;
exception
  when others then null;
end $$;

notify pgrst, 'reload schema';
