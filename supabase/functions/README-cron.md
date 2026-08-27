# TASK-052 — Deploy e agendamento das Edge Functions

## 1. Deploy (rodar localmente, onde o Supabase CLI está instalado)

```bash
supabase functions deploy check-new-releases
supabase functions deploy send-push-notifications
supabase functions deploy daily-status-recalc
```

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
```

Troque `<seu-project-ref>` e `<SERVICE_ROLE_KEY>` pelos valores reais do seu projeto (Settings → API). Isso exige as extensões `pg_cron` e `pg_net` habilitadas — Database → Extensions, no painel.

## Por que frequências diferentes

`check-new-releases` só precisa rodar 1x/dia — episódio/temporada não aparecem de hora em hora no TMDB. `send-push-notifications` roda a cada poucos minutos porque comment_reply/comment_like/review_like acontecem a qualquer momento e não faz sentido a pessoa esperar até o dia seguinte pra saber que alguém respondeu ela. `daily-status-recalc` também só precisa 1x/dia (mesmo raciocínio de `check-new-releases`) — agendado de madrugada, de propósito, pra não competir por limite de requisição do TMDB com o próprio `check-new-releases` nem com o uso normal do app durante o dia.
