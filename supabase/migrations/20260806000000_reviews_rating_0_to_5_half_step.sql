alter table public.reviews drop constraint if exists reviews_rating_check;
alter table public.reviews add constraint reviews_rating_check
  check (rating >= 0 and rating <= 5 and (rating * 2) = floor(rating * 2));

comment on column public.reviews.rating is
  '0 a 5 estrelas, passo de 0.5 (rating * 2 tem que ser inteiro). Ampliado de 1-5 pra 0-5 com meio-passo para suportar avaliacao rapida de episodio (mesma tabela, Opcao A) -- series/filmes continuam usando so 1-5 inteiro na propria interface, a constraint so ficou mais permissiva no banco, nao restringe por tipo de alvo.';

notify pgrst, 'reload schema';
