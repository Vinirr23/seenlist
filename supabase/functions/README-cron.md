# TASK-052 — Deploy e agendamento das Edge Functions

## 1. Deploy (rodar localmente, onde o Supabase CLI está instalado)

```bash
supabase functions deploy check-new-releases
supabase functions deploy send-push-notifications
supabase functions deploy daily-status-recalc
supabase functions deploy week-review-pregenerate
supabase functions deploy week-review-notify
```

`week-review-pregenerate` e `week-review-notify` compartilham código de `supabase/functions/_shared/weekBounds.ts` (import relativo) — o CLI empacota isso automaticamente no deploy de cada uma, não precisa de passo extra.

> **Nota (2026-09-24)**: a function `week-review-generate` (geração de frase via Google Gemini) e o módulo `_shared/weekReviewPhrases.ts` foram removidos por completo do projeto — problemas recorrentes de cota/latência/qualidade levaram à troca do "herói" da tela por um elemento sem IA (recorde pessoal + selo de sequência, calculado em `week-review-pregenerate`). Se você ainda tiver `week-review-generate` deployada no seu projeto Supabase, rode `supabase functions delete week-review-generate` pra remover.

## 2. Variáveis de ambiente das functions

No painel do Supabase → Edge Functions → Secrets (ou `supabase secrets set`):

```bash
supabase secrets set TMDB_API_KEY=<a mesma chave já usada em apps/web>
```

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já são injetadas automaticamente pelo Supabase em toda Edge Function — não precisa configurar.

## 3. Agendamento (cron)

O Supabase agenda Edge Functions via `pg_cron` chamando a function por HTTP. No SQL Editor, depois do deploy:

```sql
select cron.schedule(
  'check-new-releases-daily',
  '0 12 * * *', -- 12h UTC (~9h em Brasília) — horário arbitrário, ajuste se quiser
  $$
  select net.http_post(
    url := 'https://<seu-project-ref>.supabase.co/functions/v1/check-new-releases',
    headers := jsonb_build_object('Authorization', 'Bearer <SERVICE_ROLE_KEY>')
  );
  $$
);

select cron.schedule(
  'send-push-notifications-frequent',
  '*/2 * * * *', -- a cada 2 minutos — comentário/curtida não deve esperar até o dia seguinte
  $$
  select net.http_post(
    url := 'https://<seu-project-ref>.supabase.co/functions/v1/send-push-notifications',
    headers := jsonb_build_object('Authorization', 'Bearer <SERVICE_ROLE_KEY>')
  );
  $$
);

-- "Rede de segurança de 3 partes" (2026-08-26) — o job diário que
-- reaplica sozinho a mesma correção do botão "Corrigir status das
-- séries", pra TODOS os usuários, sem precisar de ninguém clicar em
-- nada. Depende da migration `20260908000000_series_status_safety_net.sql`
-- já ter sido rodada (cria a RPC `set_series_status_with_history` que
-- esta function usa pra gravar).
select cron.schedule(
  'daily-status-recalc-daily',
  '0 8 * * *', -- 8h UTC (~5h em Brasília) — de madrugada, fora do horário de uso, ajuste se quiser
  $$
  select net.http_post(
    url := 'https://<seu-project-ref>.supabase.co/functions/v1/daily-status-recalc',
    headers := jsonb_build_object('Authorization', 'Bearer <SERVICE_ROLE_KEY>')
  );
  $$
);

-- Pré-geração do Week Review (rodada 27, 2026-09-23) — calcula o
-- destaque da semana + o selo de sequência (streak_weeks) com
-- antecedência pra tela real (`app/week-review.tsx`) ler pronto
-- direto do cache. Roda 1x por semana, domingo, 17h UTC (~14h em
-- Brasília, horário escolhido pelo usuário) — dá folga antes da
-- "noite de domingo" pra qualquer reprocessamento manual se precisar.
-- Depende da migration `20260923000000_week_review_pregenerated.sql`
-- já ter sido rodada (cria a tabela `week_review_pregenerated`) e de
-- `20260923030000_week_review_no_ai_streak.sql` (coluna `phrases`
-- removida, coluna `streak_weeks` criada — rodada 31/32, sem IA).
select cron.schedule(
  'week-review-pregenerate-weekly',
  '0 17 * * 0', -- domingo, 17h UTC (~14h em Brasília)
  $$
  select net.http_post(
    url := 'https://<seu-project-ref>.supabase.co/functions/v1/week-review-pregenerate',
    headers := jsonb_build_object('Authorization', 'Bearer <SERVICE_ROLE_KEY>')
  );
  $$
);

-- Notificação push "Sua semana no SeenList" (rodada 29, 2026-09-23) —
-- lê o que `week-review-pregenerate` já calculou e insere uma linha em
-- `notifications` por usuário que teve destaque na semana (quem não
-- teve atividade não é notificado). 1h depois da pré-geração, domingo
-- 15h Brasília (horário escolhido pelo usuário, via AskUserQuestion —
-- substituiu o plano original de "à noite"). Depende da migration
-- `20260923010000_week_review_notifications.sql` já ter sido rodada
-- (coluna `title` em `week_review_pregenerated` + tipo `week_review`
-- liberado em `notifications.type`). O ENVIO de verdade continua sendo
-- feito pelo `send-push-notifications` já existente (cron de 2 em 2
-- minutos, logo abaixo) — esta function só decide quem notificar.
select cron.schedule(
  'week-review-notify-weekly',
  '0 18 * * 0', -- domingo, 18h UTC (~15h em Brasília)
  $$
  select net.http_post(
    url := 'https://<seu-project-ref>.supabase.co/functions/v1/week-review-notify',
    headers := jsonb_build_object('Authorization', 'Bearer <SERVICE_ROLE_KEY>')
  );
  $$
);
```

Troque `<seu-project-ref>` e `<SERVICE_ROLE_KEY>` pelos valores reais do seu projeto (Settings → API). Isso exige as extensões `pg_cron` e `pg_net` habilitadas — Database → Extensions, no painel.

## Por que frequências diferentes

`check-new-releases` só precisa rodar 1x/dia — episódio/temporada não aparecem de hora em hora no TMDB. `send-push-notifications` roda a cada poucos minutos porque comment_reply/comment_like/review_like acontecem a qualquer momento e não faz sentido a pessoa esperar até o dia seguinte pra saber que alguém respondeu ela. `daily-status-recalc` também só precisa 1x/dia (mesmo raciocínio de `check-new-releases`) — agendado de madrugada, de propósito, pra não competir por limite de requisição do TMDB com o próprio `check-new-releases` nem com o uso normal do app durante o dia. `week-review-pregenerate` só precisa rodar 1x/semana — o destaque da semana só faz sentido calcular depois que a semana (quase) fechou, e o objetivo é só ter o resultado pronto ANTES do horário da notificação (domingo, 15h Brasília). `week-review-notify` também só roda 1x/semana, logo depois — é o job que de fato avisa o usuário; sem ele, a única forma de abrir a tela real era o botão temporário no sheet do Perfil.
