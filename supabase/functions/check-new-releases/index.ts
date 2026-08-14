// supabase/functions/check-new-releases/index.ts
//
// TASK-052 — roda a cada 4 horas (cron, ver supabase/functions/README-cron.md
// pra configuração — frequência aumentada depois de confirmar que
// episódios de séries populares às vezes ficam disponíveis no TMDB
// horas depois do horário em que a função roda, perdendo a janela de
// 1x/dia). Responsabilidade única: detectar episódio novo / estreia
// de temporada e GRAVAR notificação — nunca envia push (isso é da
// função send-push-notifications, separada de propósito).
//
// Uma chamada ao TMDB por SÉRIE ÚNICA, não por usuário — se 500
// pessoas seguem a mesma série, é 1 chamada, não 500. A dedução de
// "já notificado" é garantida pelo índice único da migration
// (notifications_dedup_idx, versão sem `where` — ver comentário
// completo onde o insert acontece, mais abaixo) — o insert usa ON
// CONFLICT DO NOTHING, então mesmo que esta função rode duas vezes
// (retry, ou duas janelas de 4h sem novidade), nunca duplica
// notificação.

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TMDB_API_KEY = Deno.env.get("TMDB_API_KEY")!;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const ACTIVE_STATUSES = ["watching", "up_to_date", "paused"];
/** Considera "lançado" um episódio com air_date dentro dessa janela — cobre o cron não ter rodado ontem por algum motivo, sem re-notificar o catálogo inteiro. Comparação FINA (por fuso de cada pessoa) acontece por seguidor, mais abaixo — ver `isWithinRecentWindowForTimezone`. */
const RECENT_WINDOW_DAYS = 2;
/** Pré-filtro em nível de SÉRIE, mais largo que `RECENT_WINDOW_DAYS` — evita descartar cedo demais um episódio que ainda está "dentro da janela" pro fuso de algum seguidor específico, mesmo já tendo passado da janela em UTC puro. A checagem fina de verdade acontece depois, por pessoa. */
const WIDE_PRE_FILTER_DAYS = RECENT_WINDOW_DAYS + 2;

interface TmdbSeriesResponse {
  id: number;
  name: string;
  last_episode_to_air: {
    season_number: number;
    episode_number: number;
    name: string;
    air_date: string | null;
  } | null;
  /*
   * CORREÇÃO (bug real, reportado — Re:Zero/Tanya the Evil/Tomb
   * Raider King/De Caipira notificando ~20h depois do episódio já
   * ter saído, mesmo com o cron rodando a cada 4h) — confirmado numa
   * investigação anterior desta mesma sessão (tela de "Continue
   * assistindo", `seriesCategoryRecalc.ts`): esses títulos
   * específicos têm uma inconsistência de numeração conhecida e
   * documentada publicamente pelo próprio TMDB — `last_episode_to_air`
   * demora a atualizar, mas `next_episode_to_air` (campo separado, JÁ
   * incluído nesta mesma resposta de `/tv/{id}`, sem custo de
   * chamada extra) reflete o episódio mais cedo. Quando
   * `next_episode_to_air` já tem `air_date` no passado/hoje, é sinal
   * de que esse "próximo" episódio já saiu de verdade — o TMDB só
   * não promoveu ele pra `last_episode_to_air` ainda.
   */
  next_episode_to_air: {
    season_number: number;
    episode_number: number;
    name: string;
    air_date: string | null;
  } | null;
}

/**
 * CORREÇÃO (bug real, achado numa auditoria a fundo depois de "não
 * chegou notificação de novo") — as duas consultas desta função
 * (série ativa por status, e seguidores por série) buscavam TODAS as
 * linhas de uma vez, sem paginar. O Supabase corta em 1000 linhas por
 * padrão — e `series_status` tinha, por volta da época desta
 * correção, ~39 mil linhas ao todo (visto no painel de
 * observabilidade). Ou seja: a consulta quase certamente estava sendo
 * cortada nas primeiras 1000, e a função só via UMA FRAÇÃO das séries
 * que deveria — silenciosamente, sem erro nenhum denunciando o corte.
 * Séries que "por acaso" caíam fora das primeiras 1000 linhas nunca
 * eram checadas — o mesmo padrão de bug já documentado (e corrigido)
 * várias vezes neste projeto em OUTROS lugares, só que nunca tinha
 * chegado até aqui.
 */
const PAGE_SIZE = 1000;

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
 * dedup (`notifications_dedup_idx`) já impede notificar o
 * mesmo episódio duas vezes, então o pior cenário de um falso
 * positivo aqui é uma notificação só um pouco adiantada, nunca
 * duplicada.
 */
/** Pré-filtro largo, em UTC puro — só pra decidir se vale a pena buscar seguidor pra essa série (a checagem fina de verdade é por pessoa, mais abaixo). */
function isWithinRecentWindow(airDate: string | null): boolean {
  if (!airDate) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(`${airDate}T00:00:00`);
  const diffDays = Math.floor((today.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));
  return diffDays >= 0 && diffDays <= WIDE_PRE_FILTER_DAYS;
}

/**
 * CORREÇÃO (a pedido — "notificação chegou 3h adiantada, comparado
 * com meu fuso" — Slime, S04E18) — a função inteira decidia "isso é
 * hoje?" comparando com o relógio UTC do próprio servidor, não o
 * fuso de quem ia RECEBER a notificação. Resultado: pra quem está no
 * Brasil (UTC-3), o dia virava no servidor 3h antes de virar no
 * relógio da pessoa — notificação "adiantada" pelo calendário dela.
 *
 * Correção de verdade (não só trocar UTC por um fuso fixo — a base
 * já tem usuário de fora do Brasil): decide "isso é hoje" PRA CADA
 * PESSOA, usando o país cadastrado no perfil dela (texto livre,
 * então o mapeamento abaixo cobre as variações mais comuns — quem
 * não preencheu ou digitou algo não reconhecido cai no fuso do
 * Brasil, que é a maioria real da base hoje).
 *
 * RECOMENDAÇÃO REGISTRADA, fora do escopo desta correção: o campo
 * "país" do perfil é texto livre — merece virar uma lista fixa
 * (seletor) num momento futuro, tornaria esse tipo de mapeamento (e
 * qualquer outro que dependa de país) muito mais confiável. Não
 * mexido agora, pra não misturar duas tarefas diferentes.
 */
const COUNTRY_TIMEZONE_MAP: Record<string, string> = {
  brasil: "America/Sao_Paulo",
  brazil: "America/Sao_Paulo",
  br: "America/Sao_Paulo",
  portugal: "Europe/Lisbon",
  pt: "Europe/Lisbon",
  "estados unidos": "America/New_York",
  "united states": "America/New_York",
  "united states of america": "America/New_York",
  usa: "America/New_York",
  us: "America/New_York",
  eua: "America/New_York",
  espanha: "Europe/Madrid",
  spain: "Europe/Madrid",
  espana: "Europe/Madrid",
  españa: "Europe/Madrid",
  mexico: "America/Mexico_City",
  méxico: "America/Mexico_City",
  mx: "America/Mexico_City",
  argentina: "America/Argentina/Buenos_Aires",
  ar: "America/Argentina/Buenos_Aires",
  "reino unido": "Europe/London",
  "united kingdom": "Europe/London",
  uk: "Europe/London",
  england: "Europe/London",
  inglaterra: "Europe/London",
  japao: "Asia/Tokyo",
  japão: "Asia/Tokyo",
  japan: "Asia/Tokyo",
  canada: "America/Toronto",
  canadá: "America/Toronto",
  colombia: "America/Bogota",
  colômbia: "America/Bogota",
  chile: "America/Santiago",
  peru: "America/Lima",
};
/** Padrão pra quem não preencheu país, ou digitou algo não reconhecido — é a maioria real da base hoje. */
const DEFAULT_TIMEZONE = "America/Sao_Paulo";

function resolveTimezone(country: string | null | undefined): string {
  if (!country) return DEFAULT_TIMEZONE;
  const key = country.trim().toLowerCase();
  return COUNTRY_TIMEZONE_MAP[key] ?? DEFAULT_TIMEZONE;
}

/** "Hoje" no fuso de verdade da pessoa, não do servidor — usa `Intl.DateTimeFormat` (lida com horário de verão certo, não é só subtrair hora fixa). `en-CA` devolve direto no formato YYYY-MM-DD. */
function todayInTimezone(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function isWithinRecentWindowForTimezone(airDate: string | null, timeZone: string): boolean {
  if (!airDate) return true;
  const today = new Date(`${todayInTimezone(timeZone)}T00:00:00`);
  const date = new Date(`${airDate}T00:00:00`);
  const diffDays = Math.floor((today.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));
  return diffDays >= 0 && diffDays <= RECENT_WINDOW_DAYS;
}

/**
 * CORREÇÃO (bug real — timeout voltou depois de corrigir a
 * autenticação do TMDB) — o paralelismo em lotes (`TMDB_CONCURRENCY`)
 * já ajudava, mas não resolve o problema de raiz: o tempo total
 * ainda depende de quantas séries existem E de quão rápido o TMDB
 * responde naquele momento — variável demais pra garantir que fique
 * sempre abaixo do tempo que `net.http_post` espera por resposta.
 * Prova disso: antes da chave estar certa, todo pedido falhava com
 * 401 RÁPIDO (parecia terminar a tempo); com a chave certa, os
 * pedidos passaram a esperar o TMDB de verdade responder, e o
 * timeout voltou.
 *
 * A correção estrutural: parar de tentar terminar a tempo da própria
 * chamada HTTP. `EdgeRuntime.waitUntil` (recurso do runtime do
 * Supabase, feito exatamente pra isso) deixa responder JÁ, na hora
 * — o cron nunca mais espera nada — enquanto o processamento de
 * verdade continua rodando por trás, sem prazo nenhum imposto por
 * quem chamou.
 */
async function checkNewReleases(): Promise<void> {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // 1. Série única por status ativo — sem duplicar chamada por usuário.
  // Paginado (ver comentário grande acima, em `PAGE_SIZE`) — contagem
  // primeiro, depois todas as páginas em paralelo.
  const { count: statusCount, error: countError } = await supabase
    .from("series_status")
    .select("series_id", { count: "exact", head: true })
    .in("status", ACTIVE_STATUSES);

  if (countError) {
    console.error("[check-new-releases] Falha ao contar series_status", countError);
    return;
  }

  const statusPageCount = Math.ceil((statusCount ?? 0) / PAGE_SIZE);
  const statusPages = await Promise.all(
    Array.from({ length: statusPageCount }, async (_, i) => {
      const from = i * PAGE_SIZE;
      const { data, error } = await supabase
        .from("series_status")
        .select("series_id")
        .in("status", ACTIVE_STATUSES)
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        console.error(`[check-new-releases] Falha ao paginar series_status (linhas ${from}+)`, error);
        return [];
      }
      return data ?? [];
    })
  );
  const statusRows = statusPages.flat();

  const uniqueSeriesIds = [...new Set(statusRows.map((r) => r.series_id))];

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

    const lastAired = tmdbData.last_episode_to_air;
    const nextAired = tmdbData.next_episode_to_air;
    /*
     * CORREÇÃO (mesmo achado documentado na interface acima) — usa
     * `next_episode_to_air` como fonte extra quando ele já tem data
     * confirmada e já passada (ou seja: já saiu de verdade, TMDB só
     * não promoveu ainda pra `last_episode_to_air`). Se os dois
     * apontam pra episódio dentro da janela, prefere o mais recente
     * dos dois — nunca ignora um episódio mais novo por já ter
     * achado um mais velho primeiro.
     */
    const lastCandidate = lastAired && isWithinRecentWindow(lastAired.air_date) ? lastAired : null;
    const nextCandidate = nextAired && nextAired.air_date && isWithinRecentWindow(nextAired.air_date) ? nextAired : null;
    const latest =
      lastCandidate && nextCandidate
        ? (nextCandidate.air_date ?? "") > (lastCandidate.air_date ?? "")
          ? nextCandidate
          : lastCandidate
        : (lastCandidate ?? nextCandidate);
    if (!latest) continue;

    const isSeasonPremiere = latest.episode_number === 1 && latest.season_number > 1;

    // 2. Quem segue esta série, com a preferência correspondente ligada.
    // Paginado — mesma razão da consulta principal: sem isso, uma
    // série muito popular (>1000 seguidores) teria notificação
    // cortada pra só uma fração de quem segue.
    const { count: followerCount } = await supabase
      .from("series_status")
      .select("user_id", { count: "exact", head: true })
      .eq("series_id", seriesId)
      .in("status", ACTIVE_STATUSES);

    const followerPageCount = Math.ceil((followerCount ?? 0) / PAGE_SIZE);
    const followerPages = await Promise.all(
      Array.from({ length: followerPageCount }, async (_, i) => {
        const from = i * PAGE_SIZE;
        const { data, error } = await supabase
          .from("series_status")
          .select("user_id")
          .eq("series_id", seriesId)
          .in("status", ACTIVE_STATUSES)
          .range(from, from + PAGE_SIZE - 1);
        if (error) {
          console.error(`[check-new-releases] Falha ao paginar seguidores da série ${seriesId} (linhas ${from}+)`, error);
          return [];
        }
        return data ?? [];
      })
    );
    const followers = followerPages.flat();

    if (followers.length === 0) continue;

    /*
     * A PEDIDO — busca o país de cada seguidor (`profiles`, mesma
     * paginação de sempre) pra decidir "isso é hoje" no fuso de CADA
     * pessoa, não um fuso só pro sistema inteiro. Ver comentário
     * grande em `resolveTimezone`/`isWithinRecentWindowForTimezone`,
     * lá em cima, pro raciocínio completo.
     */
    const followerIds = followers.map((f) => f.user_id);
    const { count: profileCount } = await supabase
      .from("profiles")
      .select("user_id", { count: "exact", head: true })
      .in("user_id", followerIds);
    const profilePageCount = Math.ceil((profileCount ?? 0) / PAGE_SIZE);
    const profilePages = await Promise.all(
      Array.from({ length: profilePageCount }, async (_, i) => {
        const from = i * PAGE_SIZE;
        const { data, error } = await supabase
          .from("profiles")
          .select("user_id, country")
          .in("user_id", followerIds)
          .range(from, from + PAGE_SIZE - 1);
        if (error) {
          console.error(`[check-new-releases] Falha ao paginar países dos seguidores da série ${seriesId} (linhas ${from}+)`, error);
          return [];
        }
        return data ?? [];
      })
    );
    const timezoneByUser = new Map(profilePages.flat().map((p) => [p.user_id, resolveTimezone(p.country)]));

    // Só quem, NO FUSO DELE, já considera esse episódio "de hoje ou recente" — não o pré-filtro largo usado pra decidir se valia a pena chegar até aqui.
    const followersWithinTheirWindow = followers.filter((f) =>
      isWithinRecentWindowForTimezone(latest.air_date, timezoneByUser.get(f.user_id) ?? DEFAULT_TIMEZONE)
    );

    if (followersWithinTheirWindow.length === 0) continue;

    const prefColumn = isSeasonPremiere ? "season_premiere" : "episode_new";
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select(`user_id, ${prefColumn}`)
      .in(
        "user_id",
        followersWithinTheirWindow.map((f) => f.user_id)
      );

    const prefByUser = new Map((prefs ?? []).map((p) => [p.user_id, p[prefColumn as keyof typeof p]]));

    const episodeCode = `S${String(latest.season_number).padStart(2, "0")}E${String(latest.episode_number).padStart(2, "0")}`;
    const payload = isSeasonPremiere
      ? { seriesTitle: tmdbData.name, seasonNumber: latest.season_number }
      : { seriesTitle: tmdbData.name, episodeName: latest.name, episodeCode };

    const rowsToInsert = followersWithinTheirWindow
      .filter((f) => prefByUser.get(f.user_id) !== false) // sem linha de preferência = padrão ligado (opt-out)
      .map((f) => ({
        user_id: f.user_id,
        type: isSeasonPremiere ? "season_premiere" : "episode_new",
        target_type: "series" as const,
        target_id: null,
        target_media_type: "series" as const,
        target_media_id: seriesId,
        target_season_number: latest.season_number,
        /*
         * CORREÇÃO (a pedido — erro 42P10, "no unique or exclusion
         * constraint matching") — antes gravava `null` aqui pra
         * estreia de temporada. O índice único (ver migration
         * `20260830000000`) precisa ser um índice NORMAL, sem
         * `where` — e num índice normal, `NULL` nunca é igual a
         * `NULL`, então duplicata de estreia de temporada passaria
         * batida. `0` nunca é um episódio de verdade (TMDB sempre
         * começa em 1), serve de "valor vazio" comparável.
         */
        target_episode_number: isSeasonPremiere ? 0 : latest.episode_number,
        payload,
      }));

    if (rowsToInsert.length === 0) continue;

    /*
     * ON CONFLICT DO NOTHING via `notifications_dedup_idx` (migration
     * `20260830000000`) — garante que rodar esta função duas vezes
     * nunca duplica notificação. `onConflict` UNIFICADO (sempre as
     * 4 colunas, não mais um valor por tipo) — o índice agora
     * também é um só, sem `where`; o PostgREST (a camada que o
     * `.upsert()` usa por baixo) não consegue mirar num índice
     * ÚNICO PARCIAL através desse parâmetro, só um normal.
     */
    const { error: insertError, count } = await supabase
      .from("notifications")
      .upsert(rowsToInsert, {
        onConflict: "user_id,target_media_id,target_season_number,target_episode_number",
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

  // A PEDIDO — resumo vai pro log (console), não mais no corpo da
  // resposta HTTP: quem chama já recebeu resposta muito antes disso
  // terminar. Pra conferir o resultado depois, é aqui — Edge
  // Functions → check-new-releases → Logs.
  console.log(
    `[check-new-releases] concluído — seriesChecked=${uniqueSeriesIds.length} seriesWithTmdbData=${tmdbDataBySeriesId.size} episodeNotifications=${episodeNotifications} seasonNotifications=${seasonNotifications}`
  );
}

Deno.serve(() => {
  // @ts-expect-error — EdgeRuntime é uma global do runtime do Supabase (Deno Deploy), não existe no tipo padrão do Deno.
  EdgeRuntime.waitUntil(checkNewReleases());
  return new Response(JSON.stringify({ accepted: true }), {
    status: 202,
    headers: { "Content-Type": "application/json" },
  });
});
