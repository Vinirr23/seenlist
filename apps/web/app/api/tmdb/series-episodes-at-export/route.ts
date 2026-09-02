import { NextResponse } from "next/server";
import { getAllEpisodesWithAirDates } from "@/lib/tmdb/client";

interface RequestBody {
  seriesIds: number[];
  language?: string;
}

const MAX_IDS_PER_REQUEST = 20;

function sanitizeIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((id): id is number => typeof id === "number" && Number.isInteger(id) && id > 0)
    .slice(0, MAX_IDS_PER_REQUEST);
}

/**
 * TASK-027R — busca de episódios com air_date, série por série
 * (mais pesada que o resumo agregado de library-summaries, por isso
 * um lote menor). Promise.allSettled também no nível externo — uma
 * série com problema não derruba as outras do lote.
 */
export async function POST(request: Request) {
  let body: Partial<RequestBody>;
  try {
    body = (await request.json()) as Partial<RequestBody>;
  } catch (error) {
    console.error("[api/tmdb/series-episodes-at-export] Corpo da requisição inválido.", error);
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const seriesIds = sanitizeIds(body.seriesIds);
  // Opcional, padrão pt-BR — quem chama pra decidir STATUS (não exibição) nunca passa isso, e não deve mudar de comportamento.
  const language = body.language || "pt-BR";

  const settled = await Promise.allSettled(
    seriesIds.map(async (id) => ({
      id,
      episodes: await getAllEpisodesWithAirDates(String(id), language),
    }))
  );

  const series: {
    id: number;
    episodes: { seasonNumber: number; episodeNumber: number; name: string; airDate: string | null; episodeId: number }[];
  }[] = [];
  /**
   * CORREÇÃO (bug real, root cause — "só o Reacher aparece em Continue
   * assistindo na Home, os outros 4 só aparecem em 'Ver tudo'") —
   * antes, quando `getAllEpisodesWithAirDates` falhava pra uma série
   * (rejeitava a Promise), essa série simplesmente NÃO entrava no array
   * `series` — mas a resposta continuava `200 OK` (`Promise.allSettled`
   * nunca faz a rota inteira falhar, de propósito, pra 1 série ruim não
   * derrubar as outras 7 do lote). O cliente (`seriesEpisodesLight.ts`)
   * não tinha como distinguir "essa série genuinamente não tem episódio
   * nenhum" de "a busca falhou" — os dois casos chegavam como a MESMA
   * coisa: `data.series[0]` undefined → `episodes: []`. Como `[]` é um
   * resultado "de sucesso" pro React Query (não lança erro nenhum), a
   * consulta nunca tentava de novo sozinha (sem erro, sem retry) — o
   * card ficava escondido PRA SEMPRE (`ContinueWatchingCard.tsx`: sem
   * episódio pendente = não renderiza), até o cache expirar (5 min,
   * `seriesEpisodesLight.ts`) ou a pessoa recarregar a página.
   *
   * Na Home, até 8 séries disparam essa busca ao mesmo tempo, no
   * mesmo instante em que a tela monta — rajada bem mais propensa a
   * esbarrar num rate-limit da TMDB do que as mesmas buscas feitas
   * mais espaçadas no tempo (ex.: abrir "Ver tudo" alguns segundos
   * depois, quando parte já tinha sucesso em cache e o resto pega um
   * momento sem rajada) — o que explica a série aparecer ali
   * normalmente enquanto sumia na Home.
   *
   * Fix: a resposta agora também lista `failedIds` — os ids que
   * realmente falharam (não "tem 0 episódios de verdade"). O cliente
   * usa isso pra tratar esse caso como ERRO de verdade (lança, em vez
   * de devolver `[]`), o que liga o retry automático do React Query
   * (padrão do projeto, `app/providers.tsx` não desliga `retry`) — a
   * série se recupera sozinha assim que uma tentativa seguinte
   * funcionar, sem precisar sair da tela.
   */
  const failedIds: number[] = [];
  settled.forEach((outcome, index) => {
    if (outcome.status === "fulfilled") {
      series.push({
        id: outcome.value.id,
        // CORREÇÃO (2026-08-26 — "motor resistente a fusão de temporadas
        // pela TMDB") — `episodeId` (ID fixo da TMDB, `e.id`) antes era
        // descartado aqui; `getAllEpisodesWithAirDates` já trazia esse
        // dado, só não repassávamos. Usado por quem chama (mobile,
        // "Continue assistindo") pra gravar junto do episódio assistido.
        episodes: outcome.value.episodes.map((e) => ({
          seasonNumber: e.seasonNumber,
          episodeNumber: e.episodeNumber,
          name: e.name,
          airDate: e.airDate,
          episodeId: e.id,
        })),
      });
    } else {
      failedIds.push(seriesIds[index]!);
      console.error(
        `[api/tmdb/series-episodes-at-export] Falha ao buscar episódios da série ${seriesIds[index]} — as demais não são afetadas.`,
        outcome.reason
      );
    }
  });

  return NextResponse.json({ series, failedIds });
}
