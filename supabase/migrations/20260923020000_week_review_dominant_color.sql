-- =====================================================================
-- Extração de cor dominante do backdrop — pendência atacada logo
-- depois da rodada 29 (notificação push de domingo), mesma sessão
-- (2026-09-23). Decisão confirmada com o usuário via AskUserQuestion:
-- calcular a cor no SERVIDOR (`week-review-pregenerate`, Deno,
-- decodificador JPEG puro-JS via `npm:jpeg-js`) em vez de uma
-- biblioteca nativa no app, que exigiria build de dev client novo
-- (mesmo problema já vivido nas rodadas 19-20 com
-- `react-native-view-shot`/`expo-sharing`).
--
-- Guarda só a cor "crua" (média de pixel do backdrop, filtrada,
-- formato hex "#RRGGBB") — o ajuste pra virar cor de GLOW de verdade
-- (saturação/luminosidade dentro de uma faixa legível, mais a
-- derivação da cor secundária) fica no cliente
-- (`apps/mobile/lib/glowBlobs.ts`, `buildWeekReviewGlowBlobs`), pra
-- não duplicar essa conta em Deno E em React Native.
--
-- Escopo confirmado com o usuário (segunda pergunta, mesma rodada): só
-- o glow ambiente usa esta cor por enquanto — tint do gradiente sobre
-- a imagem, borda do card e marca de aspas da citação continuam fixos.
-- =====================================================================

alter table public.week_review_pregenerated
  add column if not exists dominant_color text;

notify pgrst, 'reload schema';
