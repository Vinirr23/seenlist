-- CORREÇÃO (bug real, reportado com print — episódio novo chegando
-- em rajada, várias vezes, no mesmo celular) — a causa não era
-- duplicata na CRIAÇÃO da notificação (confirmado: 68 `user_id`
-- diferentes, cada um corretamente notificado uma vez só — House of
-- the Dragon é só um título popular). A causa real: um usuário tinha
-- 24 TOKENS de push cadastrados pra ele mesmo — ninguém tem 24
-- celulares.
--
-- O registro (`registerForPushNotifications`, mobile) sempre usou
-- `upsert(..., {onConflict: "token"})` — só evita duplicata se o
-- TOKEN STRING for exatamente igual. Só que o Expo pode gerar um
-- token NOVO a cada build/reinstalação do app — e como o token
-- antigo nunca era removido (só no logout explícito), eles se
-- acumulam pra sempre a cada novo build. Ao longo desta sessão,
-- reconstruímos o app várias vezes — daí os 24.
--
-- Efeito colateral que isso também explica: o card "Instalações
-- mobile" do painel de observabilidade conta LINHAS de
-- `push_tokens` — com esse acúmulo, provavelmente conta MUITO mais
-- que o número real de aparelhos instalados de verdade.
--
-- Correção em duas partes:
-- 1. Limpa o que já acumulou — mantém só o token MAIS RECENTE
--    (`last_seen_at`) por usuário+plataforma, apaga o resto.
-- 2. Índice único em (user_id, platform) — daqui pra frente, um
--    registro novo SUBSTITUI o token antigo daquele usuário
--    naquela plataforma, em vez de somar mais uma linha.

with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, platform
      order by last_seen_at desc nulls last, id desc
    ) as rn
  from public.push_tokens
)
delete from public.push_tokens
where id in (select id from ranked where rn > 1);

create unique index if not exists push_tokens_user_platform_idx
  on public.push_tokens (user_id, platform);
