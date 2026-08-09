// supabase/functions/check-new-releases/index.ts
//
// TASK-052 — roda uma vez por dia (cron, ver supabase/functions/README-cron.md
// pra configuração). Responsabilidade única: detectar episódio novo /
// estreia de temporada e GRAVAR notificação — nunca envia push
// (isso é da função send-push-notifications, separada de propósito).
//
// Uma chamada ao TMDB por SÉRIE ÚNICA, não por usuário — se 500
// pessoas seguem a mesma série, é 1 chamada, não 500. A dedução de
// "já notificado" é garantida pelos índices únicos parciais da
// migration (notifications_dedup_episode_idx/season_idx) — o insert
// usa ON CONFLICT DO NOTHING, então mesmo que esta função rode duas
// vezes (retry, cron duplicado), nunca duplica notificação.

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TMDB_API_KEY = Deno.env.get("TMDB_API_KEY")!;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const ACTIVE_STATUSES = ["watching", "up_to_date", "paused"];
/** Considera "lançado" um episódio com air_date dentro dessa janela — cobre o cron não ter rodado ontem por algum motivo, sem re-notificar o catálogo inteiro. */
const RECENT_WINDOW_DAYS = 2;

interface TmdbSeriesResponse {
  id: number;
  name: string;
  last_episode_to_air: {
    season_number: number;
    episode_number: number;
    name: string;
    air_date: string | null;
  } | null;
}

/**
 * CORREÇÃO (a pedido — "não chegou notificação de episódio novo do
 * Slime, mesmo tendo saído ontem") — mesmo bug já corrigido em TRÊS
 * outros lugares nesta sessão (`ContinueWatchingCard.tsx` no web,
 * `nextEpisodeToWatch.ts` no mobile): o TMDB às vezes demora a
 * preencher a data de exibição do episódio mais recente de um anime
 * em exibição semanal — o episódio já saiu de verdade, só a data
 * ainda não chegou na API. Aqui era o único lugar que ainda tratava
 * "data desconhecida" como "definitivamente NÃO recente" (`!airDate
 * → false`), pulando a série (`continue`, linha ~78) e nunca criando
 * a notificação — o cron só roda 1x/dia, então perder essa janela
 * significa a pessoa nunca saber que saiu.
 *
 * Agora trata data desconhecida como "pode estar dentro da janela"
 * (mesmo espírito das outras 3 correções): o `last_episode_to_air`
 * do TMDB só passa a apontar pra um episódio novo quando ele
 * realmente está saindo/saiu, então confiar nisso mesmo sem a data
 * exata preenchida é uma aposta razoável — e o índice único de
 * dedup (`notifications_dedup_episode_idx`) já impede notificar o
 * mesmo episódio duas vezes, então o pior cenário de um falso
 * positivo aqui é uma notificação só um pouco adiantada, nunca
 * duplicada.
 */
function isWithinRecentWindow(airDate: string | null): boolean {
  if (!airDate) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(`${airDate}T00:00:00`);
  const diffDays = Math.floor((today.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));
  return diffDays >= 0 && diffDays <= RECENT_WINDOW_DAYS;
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // 1. Série única por status ativo — sem duplicar chamada por usuário.
  const { data: statusRows, error: statusError } = await supabase
    .from("series_status")
    .select("series_id")
    .in("status", ACTIVE_STATUSES);

  if (statusError) {
    console.error("[check-new-releases] Falha ao buscar series_status", statusError);
    return new Response(JSON.stringify({ error: statusError.message }), { status: 500 });
  }

  const uniqueSeriesIds = [...new Set((statusRows ?? []).map((r) => r.series_id))];

  /*
   * CORREÇÃO (bug real, achado investigando "não chegou notificação
   * de episódio novo" — a causa raiz de verdade, não as três
   * hipóteses anteriores que já tinham sido descartadas: Realtime,
   * inscrição de Web Push e a própria lógica de detecção estavam
   * todas corretas). A função nunca tinha conseguido RODAR ATÉ O
   * FIM: buscava o TMDB uma série de cada vez, num `for` comum com
   * `await` dentro — com centenas de séries diferentes sendo
   * acompanhadas, isso passa fácil de um minuto, bem além do tempo
   * que a chamada HTTP que dispara a função (`net.http_post`, via
   * cron) espera por resposta. Confirmado direto no banco:
   * `net._http_response` tinha uma linha com `status_code: null,
   * content: null` bem no horário do cron diário — a marca exata de
   * um timeout, conexão abandonada antes da função terminar.
   *
   * Corrigido separando a parte LENTA (rede, TMDB) da RÁPIDA (banco,
   * já era rápido antes): busca todas as séries em LOTES paralelos
   * (`TMDB_CONCURRENCY` de cada vez, não todas de uma vez — evita
   * estourar limite de requisição do próprio TMDB), e só DEPOIS
   * processa a lógica de notificação, série por série, sequencial
   * (essa parte já era rápida, não precisa mudar). Com paralelismo,
   * o tempo total passa a ser "tempo de UM lote", não "soma de
   * todas as séries" — ordens de grandeza mais rápido.
   */
  const TMDB_CONCURRENCY = 15;
  const tmdbDataBySeriesId = new Map<number, TmdbSeriesResponse>();

  for (let i = 0; i < uniqueSeriesIds.length; i += TMDB_CONCURRENCY) {
    const batch = uniqueSeriesIds.slice(i, i + TMDB_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (seriesId) => {
        try {
          /*
           * CORREÇÃO (bug real — 776 de 776 séries falhando com o
           * mesmo padrão, achado depois de resolver o timeout) — o
           * TMDB tem DOIS jeitos de autenticar: a API Key clássica
           * (v3, string curta, vai como parâmetro `?api_key=` na
           * URL) e o Read Access Token (v4, token longo, vai como
           * `Authorization: Bearer`). Esta função usava Bearer, mas
           * o segredo `TMDB_API_KEY` — MESMO NOME usado pelo app web
           * (`apps/web/lib/tmdb/client.ts`), quase certamente com o
           * mesmo valor copiado de lá — é do tipo clássico (o web já
           * usa `api_key=` na URL, nunca Bearer). Bearer com uma
           * chave v3 dá 401 sempre, pra qualquer série, o que bate
           * exatamente com o "0 de 776" observado.
           *
           * Agora usa o MESMO formato que o web já usa de verdade —
           * reaproveita o segredo que já existe, sem precisar de
           * credencial nova.
           */
          const response = await fetch(`${TMDB_BASE_URL}/tv/${seriesId}?api_key=${TMDB_API_KEY}`);
          if (!response.ok) return null; // série pode ter sido removida do TMDB — não trava o resto do lote
          return (await response.json()) as TmdbSeriesResponse;
        } catch (error) {
          console.error(`[check-new-releases] Falha ao buscar série ${seriesId} no TMDB`, error);
          return null;
        }
      })
    );
    batch.forEach((seriesId, idx) => {
      const data = results[idx];
      if (data) tmdbDataBySeriesId.set(seriesId, data);
    });
  }

  let episodeNotifications = 0;
  let seasonNotifications = 0;

  for (const seriesId of uniqueSeriesIds) {
    const tmdbData = tmdbDataBySeriesId.get(seriesId);
    if (!tmdbData) continue;

    const latest = tmdbData.last_episode_to_air;
    if (!latest || !isWithinRecentWindow(latest.air_date)) continue;

    const isSeasonPremiere = latest.episode_number === 1 && latest.season_number > 1;

    // 2. Quem segue esta série, com a preferência correspondente ligada.
    const { data: followers, error: followersError } = await supabase
      .from("series_status")
      .select("user_id")
      .eq("series_id", seriesId)
      .in("status", ACTIVE_STATUSES);

    if (followersError || !followers) {
      console.error(`[check-new-releases] Falha ao buscar seguidores da série ${seriesId}`, followersError);
      continue;
    }

    const prefColumn = isSeasonPremiere ? "season_premiere" : "episode_new";
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select(`user_id, ${prefColumn}`)
      .in(
        "user_id",
        followers.map((f) => f.user_id)
      );

    const prefByUser = new Map((prefs ?? []).map((p) => [p.user_id, p[prefColumn as keyof typeof p]]));

    const episodeCode = `S${String(latest.season_number).padStart(2, "0")}E${String(latest.episode_number).padStart(2, "0")}`;
    const payload = isSeasonPremiere
      ? { seriesTitle: tmdbData.name, seasonNumber: latest.season_number }
      : { seriesTitle: tmdbData.name, episodeName: latest.name, episodeCode };

    const rowsToInsert = followers
      .filter((f) => prefByUser.get(f.user_id) !== false) // sem linha de preferência = padrão ligado (opt-out)
      .map((f) => ({
        user_id: f.user_id,
        type: isSeasonPremiere ? "season_premiere" : "episode_new",
        target_type: "series" as const,
        target_id: null,
        target_media_type: "series" as const,
        target_media_id: seriesId,
        target_season_number: latest.season_number,
        target_episode_number: isSeasonPremiere ? null : latest.episode_number,
        payload,
      }));

    if (rowsToInsert.length === 0) continue;

    // ON CONFLICT DO NOTHING via os índices únicos parciais da migration —
    // garante que rodar esta função duas vezes nunca duplica notificação.
    const { error: insertError, count } = await supabase
      .from("notifications")
      .upsert(rowsToInsert, {
        onConflict: isSeasonPremiere
          ? "user_id,target_media_id,target_season_number"
          : "user_id,target_media_id,target_season_number,target_episode_number",
        ignoreDuplicates: true,
        count: "exact",
      });

    if (insertError) {
      console.error(`[check-new-releases] Falha ao inserir notificações da série ${seriesId}`, insertError);
      continue;
    }

    if (isSeasonPremiere) seasonNotifications += count ?? 0;
    else episodeNotifications += count ?? 0;
  }

  return new Response(
    JSON.stringify({
      seriesChecked: uniqueSeriesIds.length,
      // A PEDIDO — quantas séries realmente tinham dado do TMDB, vs quantas falharam/foram puladas. Ajuda a diagnosticar sem precisar ler _http_response de novo.
      seriesWithTmdbData: tmdbDataBySeriesId.size,
      episodeNotifications,
      seasonNotifications,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
