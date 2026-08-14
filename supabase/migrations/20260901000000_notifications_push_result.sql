-- A PEDIDO — investigação real (usuário específico, notificação
-- marcada como "enviada" mas nunca vista) mostrou que `pushed_at`
-- sozinho não é suficiente pra saber se um envio deu certo de
-- verdade: ele só registra QUANDO a linha foi processada, não O QUE
-- aconteceu no processamento (tinha token? tinha inscrição web?
-- quantos deram certo, quantos falharam, por quê?).
--
-- `push_result` guarda esse resumo, por notificação, gravado pela
-- Edge Function `send-push-notifications` logo depois de tentar
-- entregar. Formato (JSON):
--   { hasToken, hasWebSub, appSent, appFailed, webSent, webFailed, webErrors }
--
-- Investigação futura de "não chegou" vira uma consulta só:
--   select push_result from notifications where id = '...';
-- em vez de cruzar push_tokens/web_push_subscriptions/logs à mão.
alter table notifications
  add column if not exists push_result jsonb;

comment on column notifications.push_result is
  'Resumo do resultado do envio (app + web push), gravado por send-push-notifications. Null = ainda não processada ou não gerou mensagem (buildMessage retornou null).';
