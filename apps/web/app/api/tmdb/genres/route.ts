import { NextResponse } from "next/server";
import { getGenreMaps } from "@/lib/tmdb/client";

/**
 * Fase C da reformulação da Explorar (2026-08-21) — rota dedicada só
 * pro mapa id→nome de gênero do TMDB (`getGenreMaps` já tem cache de
 * 24h embutido, gênero praticamente nunca muda). Usada pelo hook
 * `useFavoriteGenres` pra converter o NOME do gênero (é assim que
 * `media_summaries_cache.genres` guarda — texto, não id) de volta pro
 * id numérico que `/discover/movie`/`/discover/tv` exigem.
 *
 * CORREÇÃO (achado real — "Principais séries para você" vazio) — devolve
 * os mapas de filme e série SEPARADOS (não um só fundido) — o id de
 * gênero do TMDB não é o mesmo espaço pros dois lados (ver comentário
 * grande em `getGenreMaps`, `lib/tmdb/client.ts`), então converter
 * nome→id precisa saber de qual lado o nome veio.
 *
 * `?language=` — mesmo padrão das outras rotas TMDB deste projeto;
 * sem o parâmetro, cai em pt-BR.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const language = searchParams.get("language") ?? "pt-BR";

  try {
    const { movie, tv } = await getGenreMaps(language);
    return NextResponse.json({ movieGenreMap: movie, tvGenreMap: tv });
  } catch (error) {
    console.error("[api/tmdb/genres] Falha ao buscar mapa de gêneros", error);
    return NextResponse.json({ error: "Falha ao buscar gêneros do TMDB" }, { status: 502 });
  }
}
