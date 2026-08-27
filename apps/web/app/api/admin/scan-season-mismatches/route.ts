import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { getSeriesSeasonList } from "@/lib/tmdb/client";

export const dynamic = "force-dynamic";

/**
 * DIAGNÓSTICO (2026-08-26, a pedido — "primeiro escanear a conta
 * inteira") — investigação do "Solo Leveling/Rent-a-Girlfriend/Dan Da
 * Dan/Kaiju No. 8 com episódios aparecendo como não assistidos": a
 * causa real (confirmada com print da tela e cruzada com a própria
 * TMDB) não foi perda de dado nem o bug de paginação já corrigido —
 * foi a TMDB tendo FUNDIDO temporadas desses animes (cada um lançado
 * em "cours" separados, TV Time/importação original gravou como
 * temporadas 1 e 2 distintas; a TMDB hoje devolve tudo como
 * "temporada 1" só, numeração contínua). Episódios gravados como
 * "temporada 2" nunca mais batem contra a lista atual da TMDB (que já
 * nem tem mais uma "temporada 2" pra essa série) — aparecem como
 * pendentes mesmo já assistidos de verdade.
 *
 * Esta rota NÃO corrige nada ainda — só varre TODAS as séries da
 * conta e aponta quais têm o mesmo padrão (uma linha de
 * `watched_episodes` numa temporada que a TMDB não reconhece mais
 * hoje), pra decidir o tamanho real do problema antes de remapear
 * qualquer dado. O remapeamento em si (usando o ID fixo de cada
 * episódio na TMDB pra casar a numeração antiga com a nova, em vez de
 * arriscar uma conta de "temporada × episódios por temporada") é um
 * passo separado, só pras séries que aparecerem aqui.
 *
 * Mesmo padrão de autenticação/autorização de
 * `repair-series-categories/route.ts` — só o dono do projeto pode
 * rodar, informando o `userId` de qualquer conta (usa a chave de
 * serviço, ignora RLS, do mesmo jeito que a rota irmã já faz).
 */
async function getAdminUser(): Promise<{ id: string; email: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.email !== env.adminEmail()) return null;
  return { id: user.id, email: user.email };
}

interface SeasonMismatchResult {
  seriesId: number;
  watchedSeasons: number[];
  currentTmdbMaxSeason: number | null;
  flagged: boolean;
  note?: string;
}

export async function POST(request: Request) {
  const adminUser = await getAdminUser();
  if (!adminUser) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  // CONVENIÊNCIA (a pedido — "primeiro escanear a conta inteira") —
  // diferente da rota irmã (`repair-series-categories`, feita pra
  // corrigir QUALQUER conta a partir da sua), este diagnóstico é
  // pensado primeiro pra rodar contra a PRÓPRIA conta de quem está
  // chamando — `userId` no corpo continua aceito (pra checar outra
  // conta, se um dia precisar), mas sem ele usa quem está logado
  // agora, sem precisar descobrir/colar o próprio ID à mão.
  let body: { userId?: string } = {};
  try {
    body = await request.json();
  } catch {
    // corpo vazio/ausente é válido aqui — só significa "minha própria conta".
  }

  const userId = body.userId?.trim() || adminUser.id;

  const admin = createAdminClient();

  // Mesmo padrão de paginação+ordenação já corrigido em
  // `seriesCategoryRecalc.ts`/`repair-series-categories/route.ts` —
  // ordenado por (series_id, season_number) pra paginação
  // determinística mesmo em contas com muito histórico.
  const PAGE_SIZE = 1000;
  const { count, error: countError } = await admin
    .from("watched_episodes")
    .select("series_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_special", false);
  if (countError) {
    console.error("[admin/scan-season-mismatches] Falha ao contar watched_episodes", countError);
    return NextResponse.json({ error: "Falha ao contar episódios assistidos." }, { status: 500 });
  }

  const total = count ?? 0;
  const pageCount = Math.ceil(total / PAGE_SIZE);
  const pages = await Promise.all(
    Array.from({ length: pageCount }, (_, index) => {
      const from = index * PAGE_SIZE;
      return admin
        .from("watched_episodes")
        .select("series_id, season_number")
        .eq("user_id", userId)
        .eq("is_special", false)
        .order("series_id", { ascending: true })
        .order("season_number", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
    })
  );

  const seasonsBySeriesId = new Map<number, Set<number>>();
  for (const page of pages) {
    if (page.error) {
      console.error("[admin/scan-season-mismatches] Falha ao buscar página de watched_episodes", page.error);
      return NextResponse.json({ error: "Falha ao buscar episódios assistidos." }, { status: 500 });
    }
    for (const row of (page.data ?? []) as { series_id: number; season_number: number }[]) {
      const set = seasonsBySeriesId.get(row.series_id) ?? new Set<number>();
      set.add(row.season_number);
      seasonsBySeriesId.set(row.series_id, set);
    }
  }

  const seriesIds = [...seasonsBySeriesId.keys()];

  // Concorrência limitada — mesmo espírito de `CONCURRENCY` na rota
  // irmã, pra não estourar limite de requisição da TMDB.
  const CONCURRENCY = 10;
  const results: SeasonMismatchResult[] = [];

  for (let start = 0; start < seriesIds.length; start += CONCURRENCY) {
    const batch = seriesIds.slice(start, start + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (seriesId): Promise<SeasonMismatchResult> => {
        const watchedSeasons = [...(seasonsBySeriesId.get(seriesId) ?? new Set<number>())].sort((a, b) => a - b);
        try {
          const currentSeasons = await getSeriesSeasonList(String(seriesId));
          if (currentSeasons.length === 0) {
            return {
              seriesId,
              watchedSeasons,
              currentTmdbMaxSeason: null,
              flagged: false,
              note: "TMDB não devolveu temporadas pra essa série (pode ter sido removida do catálogo) — não avaliado.",
            };
          }
          const currentMax = Math.max(...currentSeasons.map((s) => s.seasonNumber));
          // O SINAL REAL: uma temporada que o usuário assistiu e que
          // simplesmente não existe mais na estrutura atual da TMDB —
          // mais direto e menos sujeito a falso positivo do que só
          // comparar quantidade de temporadas (que pode variar por
          // motivos legítimos, como a série ainda ter temporada nova
          // saindo).
          const flagged = watchedSeasons.some((s) => s > currentMax);
          return { seriesId, watchedSeasons, currentTmdbMaxSeason: currentMax, flagged };
        } catch (error) {
          console.error(`[admin/scan-season-mismatches] Falha ao buscar temporadas da série ${seriesId} na TMDB`, error);
          return {
            seriesId,
            watchedSeasons,
            currentTmdbMaxSeason: null,
            flagged: false,
            note: "Falha ao consultar a TMDB pra essa série — não avaliado, tentar de novo depois.",
          };
        }
      })
    );
    results.push(...batchResults);
  }

  const flaggedResults = results.filter((r) => r.flagged);
  const unevaluated = results.filter((r) => r.currentTmdbMaxSeason === null);

  return NextResponse.json({
    totalSeriesScanned: results.length,
    flaggedCount: flaggedResults.length,
    unevaluatedCount: unevaluated.length,
    flagged: flaggedResults,
    unevaluated,
  });
}
