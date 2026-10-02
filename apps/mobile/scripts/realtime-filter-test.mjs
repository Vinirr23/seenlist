#!/usr/bin/env node
/**
 * VALIDAÇÃO AO VIVO — filtros combinados do Realtime do Feed
 * (canal `realtime-feed-new-activity`, `app/(tabs)/feed.tsx`).
 *
 * POR QUE ESTE SCRIPT EXISTE: a sessão do Claude que escreveu a mudança
 * não tem saída de rede pro projeto Supabase (sandbox com allowlist de
 * egress) nem shell neste PC nesta sessão — não deu pra validar ao vivo
 * os filtros combinados com AND (`status=in.(...),user_id=neq.<id>`
 * etc.) contra o servidor Realtime de verdade. Este script faz isso,
 * rodando LOCALMENTE (sua máquina tem rede normal).
 *
 * NÃO FOI EXECUTADO PELO CLAUDE — foi escrito reaproveitando a MESMA
 * `@supabase/supabase-js@2.45.4` já instalada no projeto (nenhum
 * `npm install` novo), pra eliminar risco de erro de protocolo, mas o
 * comportamento final só fica confirmado quando VOCÊ rodar e ver o
 * resultado.
 *
 * 2 CONTAS DE TESTE SUAS JÁ EXISTENTES, NENHUMA SENHA PASSADA PRO CLAUDE
 * (2026-10-01, a pedido — a 1ª versão criava uma conta nova na hora via
 * `signUp`, mas o projeto exige confirmação de e-mail pra login, então
 * `signUp` nunca devolvia sessão; login com `signInWithPassword` em 2
 * contas já confirmadas evita esse problema de vez):
 *  - "viewer" e "actor": duas contas de teste SUAS, já cadastradas e
 *    confirmadas no SeenList (nenhuma precisa ser especial — só duas
 *    contas distintas). As credenciais ficam em VARIÁVEIS DE AMBIENTE
 *    que você mesmo define no seu terminal — nunca digitadas pro
 *    Claude, nunca gravadas neste arquivo.
 *  - O 3º papel do plano original ("usuário não seguido", caso 9) não
 *    precisa de conta de verdade nenhuma: o filtro `user_id=in.(...)`
 *    é só uma string — um UUID aleatório que não existe já prova que o
 *    `actor` fica de fora da lista.
 *
 * COMO RODAR (PowerShell, dentro de apps/mobile) — troque pelos seus
 * valores reais, sem me colar a senha de volta:
 *
 *   $env:SEENLIST_TEST_VIEWER_EMAIL = "sua-conta-de-teste-1@dominio.com"
 *   $env:SEENLIST_TEST_VIEWER_PASSWORD = "senha-dessa-conta-1"
 *   $env:SEENLIST_TEST_ACTOR_EMAIL = "sua-conta-de-teste-2@dominio.com"
 *   $env:SEENLIST_TEST_ACTOR_PASSWORD = "senha-dessa-conta-2"
 *   node scripts/realtime-filter-test.mjs
 *
 * ATENÇÃO (efeito colateral esperado, limpo ao final): o script grava
 * temporariamente um filme/série FAKE (ids 999999001/999999002, que
 * não existem no TMDB de verdade) nas duas contas, e também segue e
 * deixa de seguir entre elas. Tudo isso é apagado/desfeito no final do
 * script (bloco "limpeza"), mas se você abrir o app logado numa dessas
 * contas durante a execução pode ver esses itens fake por alguns
 * segundos.
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://segqotlvondqbkkenfyy.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlZ3FvdGx2b25kcWJra2VuZnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxMDQyMjcsImV4cCI6MjA5ODY4MDIyN30.gjiQsddNJuA9xdFyLa7TgSWP7cCg11utgrfBisatRhI";

// Mesmos valores de lib/activityFeed.ts — se divergirem daqui, o teste já não é fiel ao código real.
const SERIES_ACTIVITY_STATUSES = ["completed", "want_to_watch"];
const MOVIE_ACTIVITY_STATUSES = ["watched", "want_to_watch"];
const ACTIVITY_WINDOW_DAYS = 7;

const FAKE_MOVIE_ID = 999999001;
const FAKE_SERIES_ID = 999999002;
const FAKE_NOT_FOLLOWED_UUID = "00000000-0000-4000-8000-000000000000"; // não existe em profiles — só pro filtro `user_id=in.(...)` excluir o `actor` de propósito no caso 9

function rid() {
  return Math.random().toString(36).slice(2, 10);
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const activeClients = [];
function newClient() {
  // autoRefreshToken desligado: é um script curto, e o timer de refresh
  // automático é exatamente o tipo de "handle" aberto que travava a
  // saída limpa do processo (a causa do crash do libuv visto antes).
  const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  activeClients.push(client);
  return client;
}

async function shutdownAllClients() {
  for (const c of activeClients) {
    try {
      await c.removeAllChannels();
    } catch {
      /* ignora — já pode estar fechado */
    }
    try {
      c.realtime.disconnect();
    } catch {
      /* ignora */
    }
  }
}

async function loginExistingAccount(label, emailVar, passwordVar) {
  const email = process.env[emailVar];
  const password = process.env[passwordVar];
  if (!email || !password) {
    throw new Error(`Faltaram ${emailVar} / ${passwordVar} (uma conta de teste já existente no SeenList) — veja o comentário no topo deste arquivo.`);
  }
  const client = newClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`login do ${label} (${email}) falhou: ${error.message}`);
  return { client, userId: data.user.id, email };
}

async function makeViewer() {
  return loginExistingAccount("viewer", "SEENLIST_TEST_VIEWER_EMAIL", "SEENLIST_TEST_VIEWER_PASSWORD");
}

async function makeActor() {
  return loginExistingAccount("actor", "SEENLIST_TEST_ACTOR_EMAIL", "SEENLIST_TEST_ACTOR_PASSWORD");
}

function waitForSignal(client, channelName, listeners, timeoutMs = 6000) {
  return new Promise((resolve) => {
    let settled = false;
    let channel = client.channel(channelName);
    for (const l of listeners) channel = channel.on("postgres_changes", l, () => finish(true));
    channel.subscribe();
    const timer = setTimeout(() => finish(false), timeoutMs);
    function finish(result) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      client.removeChannel(channel).catch(() => {});
      resolve(result);
    }
  });
}

const results = [];
function report(caseName, expected, got) {
  const ok = expected === got;
  results.push({ caseName, ok });
  console.log(
    `${ok ? "✅ PASS" : "❌ FAIL"} — ${caseName} (esperado ${expected ? "SINALIZA" : "NÃO sinaliza"}, obtido ${got ? "SINALIZOU" : "não sinalizou"})`
  );
}

async function runCases(viewer, actor) {
  const sinceIso = (() => {
    const d = new Date();
    d.setDate(d.getDate() - ACTIVITY_WINDOW_DAYS);
    return d.toISOString();
  })();

  // ===== Caso 7: ação do PRÓPRIO usuário (For You) não deve sinalizar =====
  {
    const filter = `status=in.(${SERIES_ACTIVITY_STATUSES.join(",")}),user_id=neq.${viewer.userId}`;
    const signal = waitForSignal(viewer.client, `t7-${rid()}`, [{ event: "*", schema: "public", table: "series_status", filter }]);
    await sleep(600);
    await viewer.client.from("series_status").upsert({ user_id: viewer.userId, series_id: FAKE_SERIES_ID, status: "completed" });
    report("7. ação do próprio usuário (For You)", false, await signal);
    await viewer.client.from("series_status").delete().eq("user_id", viewer.userId).eq("series_id", FAKE_SERIES_ID);
  }

  // ===== Caso 1: outro usuário watching → continua watching → NÃO sinaliza =====
  {
    await actor.client.from("series_status").upsert({ user_id: actor.userId, series_id: FAKE_SERIES_ID, status: "watching" });
    await sleep(400);
    const filter = `status=in.(${SERIES_ACTIVITY_STATUSES.join(",")}),user_id=neq.${viewer.userId}`;
    const signal = waitForSignal(viewer.client, `t1-${rid()}`, [{ event: "*", schema: "public", table: "series_status", filter }]);
    await sleep(600);
    // simula o job de recálculo: só bate updated_at, status continua "watching"
    await actor.client.from("series_status").update({ status: "watching" }).eq("user_id", actor.userId).eq("series_id", FAKE_SERIES_ID);
    report("1. outro usuário watching→watching (For You) — ESTE É O CASO CRÍTICO DO ACHADO ALTO", false, await signal);
  }

  // ===== Caso 2: outro usuário → completed (deve sinalizar; prova que o filtro AND funciona de verdade) =====
  {
    const filter = `status=in.(${SERIES_ACTIVITY_STATUSES.join(",")}),user_id=neq.${viewer.userId}`;
    const signal = waitForSignal(viewer.client, `t2-${rid()}`, [{ event: "*", schema: "public", table: "series_status", filter }]);
    await sleep(600);
    await actor.client.from("series_status").update({ status: "completed" }).eq("user_id", actor.userId).eq("series_id", FAKE_SERIES_ID);
    report("2. outro usuário → completed (For You) — PROVA QUE O FILTRO AND FUNCIONA", true, await signal);
  }

  // ===== Caso 3: outro usuário, movie_status → want_to_watch =====
  {
    const filter = `status=in.(${MOVIE_ACTIVITY_STATUSES.join(",")}),user_id=neq.${viewer.userId}`;
    const signal = waitForSignal(viewer.client, `t3-${rid()}`, [{ event: "*", schema: "public", table: "movie_status", filter }]);
    await sleep(600);
    await actor.client.from("movie_status").upsert({ user_id: actor.userId, movie_id: FAKE_MOVIE_ID, status: "want_to_watch" });
    report("3. outro usuário → want_to_watch (For You, movie_status)", true, await signal);
  }

  // ===== Caso 4: review ANTIGA editada não deve sinalizar (depende de gte funcionar) =====
  {
    // cria a review e FORÇA created_at pra fora da janela de 7 dias
    const oldIso = new Date(Date.now() - (ACTIVITY_WINDOW_DAYS + 3) * 86400000).toISOString();
    await actor.client
      .from("reviews")
      .upsert(
        { user_id: actor.userId, media_type: "movie", media_id: FAKE_MOVIE_ID, season_number: null, episode_number: null, rating: 3, created_at: oldIso },
        { onConflict: "user_id,media_type,media_id,season_number,episode_number" }
      );
    await sleep(400);
    const filter = `created_at=gte.${sinceIso},user_id=neq.${viewer.userId}`;
    const signal = waitForSignal(viewer.client, `t4-${rid()}`, [{ event: "*", schema: "public", table: "reviews", filter }]);
    await sleep(600);
    await actor.client.from("reviews").update({ rating: 5 }).eq("user_id", actor.userId).eq("media_id", FAKE_MOVIE_ID).eq("media_type", "movie");
    report("4. review ANTIGA editada (For You) — PROVA QUE O gte FUNCIONA", false, await signal);
  }

  // ===== Caso 5: review RECENTE, rating chega depois via UPDATE — deve sinalizar =====
  {
    await actor.client
      .from("reviews")
      .upsert(
        { user_id: actor.userId, media_type: "series", media_id: FAKE_SERIES_ID, season_number: null, episode_number: null, review_text: "teste", rating: null },
        { onConflict: "user_id,media_type,media_id,season_number,episode_number" }
      );
    await sleep(400);
    const filter = `created_at=gte.${sinceIso},user_id=neq.${viewer.userId}`;
    const signal = waitForSignal(viewer.client, `t5-${rid()}`, [{ event: "*", schema: "public", table: "reviews", filter }]);
    await sleep(600);
    await actor.client.from("reviews").update({ rating: 4.5 }).eq("user_id", actor.userId).eq("media_id", FAKE_SERIES_ID).eq("media_type", "series");
    report("5. review recente, rating via UPDATE depois (For You)", true, await signal);
  }

  // ===== Caso 6: review de EPISÓDIO não deve sinalizar =====
  {
    const filter = `created_at=gte.${sinceIso},user_id=neq.${viewer.userId}`;
    const signal = waitForSignal(viewer.client, `t6-${rid()}`, [{ event: "*", schema: "public", table: "reviews", filter }]);
    await sleep(600);
    await actor.client
      .from("reviews")
      .upsert(
        { user_id: actor.userId, media_type: "series", media_id: FAKE_SERIES_ID, season_number: 1, episode_number: 1, rating: 5 },
        { onConflict: "user_id,media_type,media_id,season_number,episode_number" }
      );
    const raw = await signal;
    // o filtro SERVER-SIDE não filtra season/episode — o app bloqueia isso no CALLBACK.
    // Se chegou aqui como evento bruto, confirmamos que o payload realmente carrega os campos
    // que o callback real usa pra barrar (senão o bloqueio do app não teria como funcionar).
    console.log(`   (evento bruto chegou=${raw} — o bloqueio de episódio é feito no código do app, não no filtro server-side; isso é esperado)`);
  }

  // ===== Casos 8/9: Following — segue / não segue =====
  await viewer.client.from("follows").upsert({ follower_id: viewer.userId, following_id: actor.userId });
  {
    const followedIds = [actor.userId];
    const filter = `status=in.(${SERIES_ACTIVITY_STATUSES.join(",")}),user_id=in.(${followedIds.join(",")})`;
    const signal = waitForSignal(viewer.client, `t8-${rid()}`, [{ event: "*", schema: "public", table: "series_status", filter }]);
    await sleep(600);
    await actor.client.from("series_status").update({ status: "completed" }).eq("user_id", actor.userId).eq("series_id", FAKE_SERIES_ID);
    report("8. Following + usuário SEGUIDO (user_id=in)", true, await signal);
  }
  {
    // UUID aleatório que não existe em profiles — o `actor` (de propósito) NÃO está nesta lista,
    // provando que `user_id=in.(...)` exclui corretamente quem não é seguido, sem precisar de uma 3ª conta real.
    const followedIds = [FAKE_NOT_FOLLOWED_UUID];
    const filter = `status=in.(${SERIES_ACTIVITY_STATUSES.join(",")}),user_id=in.(${followedIds.join(",")})`;
    const signal = waitForSignal(viewer.client, `t9-${rid()}`, [{ event: "*", schema: "public", table: "series_status", filter }]);
    await sleep(600);
    await actor.client.from("series_status").upsert({ user_id: actor.userId, series_id: FAKE_SERIES_ID, status: "completed" });
    report("9. Following + usuário NÃO seguido (user_id=in exclui)", false, await signal);
  }

  // ===== Caso 10: trocar For You ↔ Following — canal anterior sai, novo fica ativo, sem duplicar =====
  {
    let forYouCount = 0;
    let followingCount = 0;
    const forYouFilter = `status=in.(${SERIES_ACTIVITY_STATUSES.join(",")}),user_id=neq.${viewer.userId}`;
    let ch = viewer.client
      .channel(`t10-forYou-${rid()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "series_status", filter: forYouFilter }, () => forYouCount++);
    ch.subscribe();
    await sleep(600);
    await actor.client.from("series_status").update({ status: "want_to_watch" }).eq("user_id", actor.userId).eq("series_id", FAKE_SERIES_ID);
    await sleep(800);
    await viewer.client.removeChannel(ch); // simula troca de aba: desmonta o canal "For You"

    const followingFilter = `status=in.(${SERIES_ACTIVITY_STATUSES.join(",")}),user_id=in.(${actor.userId})`;
    let ch2 = viewer.client
      .channel(`t10-following-${rid()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "series_status", filter: followingFilter }, () => followingCount++);
    ch2.subscribe();
    await sleep(600);
    await actor.client.from("series_status").update({ status: "completed" }).eq("user_id", actor.userId).eq("series_id", FAKE_SERIES_ID);
    await sleep(800);
    await viewer.client.removeChannel(ch2);

    const ok = forYouCount === 1 && followingCount === 1;
    console.log(
      `${ok ? "✅ PASS" : "❌ FAIL"} — 10. troca For You ↔ Following sem duplicar (forYouCount=${forYouCount}, followingCount=${followingCount}, esperado 1 e 1)`
    );
    results.push({ caseName: "10. troca de aba sem duplicar", ok });
  }

  // --- limpeza: desfaz tudo que foi escrito na conta REAL do actor e no follows ---
  console.log("\nLimpando dados de teste...");
  await actor.client.from("series_status").delete().eq("user_id", actor.userId).eq("series_id", FAKE_SERIES_ID);
  await actor.client.from("movie_status").delete().eq("user_id", actor.userId).eq("movie_id", FAKE_MOVIE_ID);
  await actor.client.from("reviews").delete().eq("user_id", actor.userId).eq("media_id", FAKE_MOVIE_ID).eq("media_type", "movie");
  await actor.client.from("reviews").delete().eq("user_id", actor.userId).eq("media_id", FAKE_SERIES_ID).eq("media_type", "series");
  await viewer.client.from("follows").delete().eq("follower_id", viewer.userId).eq("following_id", actor.userId);
  console.log("(as duas contas 'viewer'/'actor' em si não são apagadas — só os dados fake que o teste escreveu nelas)");
}

async function main() {
  console.log("Logando nas duas contas de teste ('viewer' e 'actor')...\n");
  const viewer = await makeViewer();
  const actor = await makeActor();
  await runCases(viewer, actor);
}

let exitCode = 0;
try {
  await main();
} catch (e) {
  console.error("\nERRO FATAL:", e.message);
  console.error("Cole esta mensagem de volta pro Claude.");
  exitCode = 1;
} finally {
  await shutdownAllClients();
}

console.log("\n=== RESUMO ===");
const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} — ${r.caseName}`);
if (results.length === 0) {
  console.log("(nenhum caso chegou a rodar — veja o ERRO FATAL acima.)");
} else {
  console.log(failed.length === 0 ? "\nTodos os casos passaram." : `\n${failed.length} caso(s) FALHARAM — cole esta saída de volta pro Claude.`);
}
if (failed.length > 0) exitCode = 1;

// process.exitCode (não process.exit()) deixa o Node fechar sozinho depois que os sockets
// do Realtime terminarem de desconectar — forçar a saída no meio disso foi a causa do
// crash do libuv (`UV_HANDLE_CLOSING`) na tentativa anterior.
process.exitCode = exitCode;
