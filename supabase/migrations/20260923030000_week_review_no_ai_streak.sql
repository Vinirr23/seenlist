-- =====================================================================
-- Remove a geração de frase por IA do Week Review (rodada 31,
-- 2026-09-23) — decisão do usuário depois de uma sessão inteira de
-- problemas reais e recorrentes com a API do Gemini (rate limit 429,
-- respostas cortadas, latência alta, texto "sem graça" mesmo depois do
-- prompt reforçado, e por fim um "Couldn't generate new phrases right
-- now" visível na tela real pro próprio usuário). Substituída por um
-- elemento 100% determinístico — sem rede, sem IA, sem espera —
-- calculado a partir de dados reais: "recorde pessoal" (quantos
-- episódios/filmes da obra em destaque o usuário assistiu essa semana)
-- + selo de sequência (quantas semanas seguidas a mesma obra foi o
-- destaque). Direção visual escolhida entre mockups comparativos
-- ("Combinação A": recorde como elemento fixo, sequência como selo de
-- apoio só quando existe de verdade).
--
-- A coluna `phrases` (rodada 28) não tem mais nenhum gravador nem
-- leitor no código depois desta rodada — removida por completo, não só
-- deixada sem uso, por pedido explícito do usuário.
-- =====================================================================

alter table public.week_review_pregenerated
  drop column if exists phrases;

-- Quantas semanas seguidas (incluindo esta) a mesma obra
-- (media_type + media_id) foi o destaque deste usuário. `1` é o valor
-- neutro — sem sequência real, só esta semana; a UI só mostra o selo
-- de sequência quando o valor é >= 2.
alter table public.week_review_pregenerated
  add column if not exists streak_weeks integer not null default 1;

comment on column public.week_review_pregenerated.streak_weeks is
  'Quantas semanas seguidas (incluindo esta) a mesma obra (media_type+media_id) foi o destaque deste usuário. Calculado em week-review-pregenerate, comparando com as linhas anteriores desta mesma tabela. 1 = sem sequência real.';

notify pgrst, 'reload schema';
