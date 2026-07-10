-- TASK-048 — auditoria confirmou que comments/reviews/likes já
-- existem inteiros (TASK-031, 20260731000000). Única mudança real
-- necessária: a nota da review foi desenhada como 0-10 (decimal),
-- mas o MVP pede 1-5 estrelas. Nenhuma tabela nova, nenhuma coluna
-- nova — só a faixa aceita pela constraint.
alter table public.reviews drop constraint if exists reviews_rating_check;
alter table public.reviews add constraint reviews_rating_check check (rating >= 1 and rating <= 5);

comment on column public.reviews.rating is
  '1 a 5 estrelas (inteiro na prática, coluna continua numeric por já existir assim -- nao muda o tipo pra nao ser uma alteracao estrutural desnecessaria).';

notify pgrst, 'reload schema';
