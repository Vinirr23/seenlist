-- WEB PUSH — notificação de episódio novo pra quem usa o SITE.
--
-- POR QUE ISSO É A PRIORIDADE (dado real do painel de
-- observabilidade): a retenção D7 de quem tem o app instalado é 36%,
-- contra 4% de quem só usa o site — nove vezes mais. A hipótese mais
-- forte pra essa diferença é o aviso de episódio novo, que só existe
-- no app. Mas 81% dos usuários (311 de 356) estão só no site, e não
-- há app de iOS previsto — ou seja, a maior parte da base nunca vai
-- receber esse aviso pelo caminho atual.
--
-- Web Push resolve isso sem app: o navegador entrega a notificação,
-- inclusive com o site fechado. Funciona em Chrome/Firefox/Edge
-- (Android e computador) e no Safari/iOS — neste último só depois de
-- a pessoa adicionar o site à tela de início, limitação do próprio
-- Safari, não nossa.
--
-- Esta tabela é o equivalente web de `push_tokens` (que guarda o
-- token do Expo pro app). Estrutura diferente porque o padrão é
-- outro: em vez de um token, o navegador devolve um endpoint + duas
-- chaves de criptografia, e a mensagem é cifrada de ponta a ponta —
-- nem o serviço de push do navegador consegue ler o conteúdo.

create table if not exists public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- URL única que o navegador dá pra receber push. É o identificador
  -- de verdade da inscrição (não o user_id): a mesma pessoa pode ter
  -- uma por navegador/aparelho.
  endpoint text not null unique,
  -- Chaves de criptografia geradas pelo navegador. Sem elas não dá
  -- pra cifrar a mensagem, e o envio falha.
  p256dh text not null,
  auth text not null,
  -- Pra saber de onde veio, e ajudar a depurar caso um navegador
  -- específico dê problema.
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists web_push_subscriptions_user_idx
  on public.web_push_subscriptions (user_id);

alter table public.web_push_subscriptions enable row level security;

-- Cada pessoa só enxerga e mexe nas PRÓPRIAS inscrições. O envio é
-- feito pela Edge Function com a chave de serviço, que ignora RLS.
drop policy if exists "usuário vê as próprias inscrições" on public.web_push_subscriptions;
create policy "usuário vê as próprias inscrições"
  on public.web_push_subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists "usuário cria a própria inscrição" on public.web_push_subscriptions;
create policy "usuário cria a própria inscrição"
  on public.web_push_subscriptions for insert
  with check (auth.uid() = user_id);

drop policy if exists "usuário atualiza a própria inscrição" on public.web_push_subscriptions;
create policy "usuário atualiza a própria inscrição"
  on public.web_push_subscriptions for update
  using (auth.uid() = user_id);

-- Necessário pra remover a inscrição ao desativar notificação ou
-- sair da conta — sem isso a pessoa continuaria recebendo aviso.
drop policy if exists "usuário remove a própria inscrição" on public.web_push_subscriptions;
create policy "usuário remove a própria inscrição"
  on public.web_push_subscriptions for delete
  using (auth.uid() = user_id);
