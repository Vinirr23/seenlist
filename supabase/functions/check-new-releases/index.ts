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

function isWithinRecentWindow(airDate: string | null): boolean {
  if (!airDate) return false;
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
  let episodeNotifications = 0;
  let seasonNotifications = 0;

  for (const seriesId of uniqueSeriesIds) {
    let tmdbData: TmdbSeriesResponse;
    try {
      const response = await fetch(`${TMDB_BASE_URL}/tv/${seriesId}`, {
        headers: { Authorization: `Bearer ${TMDB_API_KEY}` },
      });
      if (!response.ok) continue; // série pode ter sido removida do TMDB — não trava o resto do lote
      tmdbData = await response.json();
    } catch (error) {
      console.error(`[check-new-releases] Falha ao buscar série ${seriesId} no TMDB`, error);
      continue;
    }

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
      episodeNotifications,
      seasonNotifications,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
