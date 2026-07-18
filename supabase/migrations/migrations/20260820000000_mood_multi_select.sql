-- =====================================================================
-- TASK-173 — "Como você se sentiu?" passa a aceitar MÚLTIPLAS
-- reações por episódio (era escolha única). `mood` muda de `text`
-- pra `text[]` — o `using` abaixo migra o dado que já existe sem
-- perder nada: quem já tinha uma reação salva vira uma lista de um
-- item só; quem nunca tinha reagido continua null.
-- =====================================================================

alter table public.reviews
  alter column mood type text[]
  using case when mood is null then null else array[mood] end;

notify pgrst, 'reload schema';
