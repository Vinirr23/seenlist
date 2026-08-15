import { NextResponse } from "next/server";
import { getSeriesDetails, getSeriesSeasonList, getSeasonEpisodes } from "@/lib/tmdb/client";
import type { EpisodeContextPayload, EpisodeContextSeason } from "@/lib/queries/episode-series-context";

/**
 * ACHADO DE PERFORMANCE (a pedido — auditoria da tela de Episódio) —
 * ver comentário completo em `episode-series-context.ts` (o hook que
 * chama esta rota). Resumo: a tela de Episódio só precisa de
 * título/elenco (pra personagem de anime) e do NÚMERO de cada
 * episódio da temporada atual + anterior + seguinte (pra
 * "anterior/próximo") — nunca sinopse/imagem/data de cada episódio,
 * nem elenco completo/trailer/galeria/títulos parecidos que a página
 * da Série usa. Escopo estreito, de propósito: só esta tela passa a
 * usar esta rota; `/api/tmdb/series/[id]` (página da Série) continua
 * exatamente como sempre foi.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; season: string }> }
) {
  const { id, season } = await params;
  const seasonNumber = Number(season);
  const { searchParams } = new URL(request.url);
  const language = searchParams.get("language") || "pt-BR";

  if (!Number.isInteger(seasonNumber)) {
    return NextResponse.json({ error: "Temporada inválida." }, { status: 400 });
  }

  try {
    const [details, seasonList] = await Promise.all([getSeriesDetails(id, language), getSeriesSeasonList(id, language)]);

    const sortedSeasonNumbers = seasonList.map((s) => s.seasonNumber).sort((a, b) => a - b);
    const currentIndex = sortedSeasonNumbers.indexOf(seasonNumber);
    const neededSeasonNumbers = [...new Set([
      currentIndex > 0 ? sortedSeasonNumbers[currentIndex - 1] : undefined,
      sortedSeasonNumbers[currentIndex] ?? seasonNumber,
      currentIndex >= 0 && currentIndex < sortedSeasonNumbers.length - 1 ? sortedSeasonNumbers[currentIndex + 1] : undefined,
    ].filter((n): n is number => n !== undefined))];

    const seasons: EpisodeContextSeason[] = await Promise.all(
      neededSeasonNumbers.map(async (sn) => {
        const episodes = await getSeasonEpisodes(id, sn, language);
        return {
          seasonNumber: sn,
          episodes: episodes.map((e) => ({ seasonNumber: e.seasonNumber, episodeNumber: e.episodeNumber })),
        };
      })
    );

    const payload: EpisodeContextPayload = {
      title: details.title,
      matchTitle: details.matchTitle,
      firstAirDate: details.firstAirDate,
      cast: details.cast,
      seasons,
    };
    return NextResponse.json(payload);
  } catch (error) {
    console.error(`[api/tmdb/series/${id}/season/${season}/episode-context] Falha ao carregar contexto.`, error);
    return NextResponse.json({ error: "Não foi possível carregar o contexto do episódio agora." }, { status: 502 });
  }
}
