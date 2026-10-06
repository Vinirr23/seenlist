-- =====================================================================
-- "Activity vs. Post de Review" (2026-10-06) — auditoria aprovada pelo
-- usuário: Post de Review só existe quando há opinião publicada de
-- verdade (`body` não vazio); nota sem texto continua sendo Activity
-- automática, sem Like/Comment.
--
-- `review_watched_snapshot`: indica se, no momento em que esta review
-- foi PUBLICADA OU REPUBLICADA deliberadamente (`createReviewPost`,
-- `lib/posts.ts`), o usuário tinha o título marcado como assistido
-- (`movie_status.status = 'watched'` / `series_status.status =
-- 'completed'`). É um snapshot da última publicação/atualização
-- deliberada, não um estado vivo da biblioteca — uma mudança posterior
-- em movie_status/series_status, sem nova edição/republicação da
-- review, NÃO altera este valor. Mesmo princípio de
-- media_title/media_poster_path (20260814000000_posts_review_type.sql).
--
-- `null` para posts antigos criados antes deste campo existir (nunca
-- calculado) — sem backfill artificial, por decisão explícita do
-- usuário.
-- =====================================================================

alter table public.posts add column if not exists review_watched_snapshot boolean;

comment on column public.posts.review_watched_snapshot is
  'Snapshot, não referência: indica se, na última publicação/republicação deliberada desta review (createReviewPost), o usuário tinha o título marcado como assistido. NÃO reflete o estado atual da biblioteca. NULL = post anterior a este campo, nunca calculado (sem backfill artificial).';
