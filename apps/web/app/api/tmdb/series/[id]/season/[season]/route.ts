import { NextResponse } from "next/server";
import { getPublicSeasonDetails } from "@/lib/tmdb/client";

/**
 * A PEDIDO (2026-10-09 — redesign das páginas públicas de filme/série,
 * item 5: seletor de temporada sem exigir login, carregamento sob
 * demanda). Rota NOVA, uma temporada por vez — chamada pelo
 * `PublicSeasonExplorer` ("use client") só quando a pessoa troca de
 * aba de temporada na página pública `/title/series/[id]`. Já cai na
 * exceção pública existente `pathname.startsWith("/api/tmdb/")` do
 * middleware (`lib/supabase/middleware.ts`) — nenhuma mudança lá
 * necessária, mesmo raciocínio já documentado pra `/api/tmdb/movie/[id]`
 * e `/api/tmdb/series/[id]`: só repassa dado público da TMDB, nenhum
 * dado de usuário.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; season: string }> }
) {
  const { id, season } = await params;
  const seasonNumber = Number(season);
  if (!Number.isFinite(seasonNumber) || seasonNumber < 1) {
    return NextResponse.json({ error: "Temporada inválida." }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const language = searchParams.get("language") || "pt-BR";

  try {
    const details = await getPublicSeasonDetails(id, seasonNumber, language);
    return NextResponse.json(details);
  } catch (error) {
    console.error(`[api/tmdb/series/${id}/season/${seasonNumber}] Falha ao carregar temporada.`, error);
    return NextResponse.json({ error: "Não foi possível carregar esta temporada agora." }, { status: 502 });
  }
}
