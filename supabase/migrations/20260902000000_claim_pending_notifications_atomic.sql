-- CORREÇÃO (bug real, reportado com print — mesma notificação de
-- episódio chegando 7 vezes seguidas, mesmo minuto) — causa raiz
-- diferente da correção anterior de duplicata (5564906, "pushed_at
-- marcado tarde demais"). Aquela correção resolve duas EXECUÇÕES em
-- SEQUÊNCIA (uma atrás da outra, ciclos de cron diferentes) pegarem a
-- mesma notificação de novo. Não resolve duas execuções SOBREPOSTAS
-- (rodando ao mesmo tempo de verdade).
--
-- `send-push-notifications` é chamada a cada 2 minutos via
-- `pg_cron` + `net.http_post` (ver README-cron.md) — e `net.http_post`
-- é fire-and-forget, não espera a chamada anterior terminar antes de
-- disparar a próxima. Se UMA execução demorar mais que 2 minutos por
-- qualquer motivo (lentidão pro Expo/navegador, pico de notificações
-- pendentes), várias execuções ficam rodando ao mesmo tempo de
-- verdade. O código fazia a "reserva" em DOIS passos separados —
-- `SELECT ... where pushed_at is null` e só depois `UPDATE ... set
-- pushed_at`. Entre um passo e outro, uma segunda execução podia
-- fazer o MESMO `SELECT` e enxergar a mesma notificação como "ainda
-- não enviada", antes da primeira terminar de gravar. Cada execução
-- só sabe da PRÓPRIA tentativa de envio (por isso `push_result` no
-- banco mostrava só 1 envio bem-sucedido, mesmo com 7 pushes reais
-- tendo saído — cada execução sobrescrevia o resultado da anterior,
-- cada uma "achando" que foi a única a mandar).
--
-- Corrigido substituindo os dois passos por UM SÓ comando atômico:
-- `UPDATE ... FOR UPDATE SKIP LOCKED ... RETURNING *`. Isso garante,
-- de verdade, que cada linha só pode ser reivindicada por UMA
-- execução — mesmo que várias rodem ao mesmo tempo, a segunda pula
-- (`SKIP LOCKED`) qualquer linha que a primeira já esteja segurando,
-- em vez de enxergar a mesma linha como livre.

create or replace function public.claim_pending_notifications(p_limit integer)
returns setof public.notifications
language sql
as $$
  update public.notifications
  set pushed_at = now()
  where id in (
    select id
    from public.notifications
    where pushed_at is null
    order by created_at asc
    limit p_limit
    for update skip locked
  )
  returning *;
$$;
