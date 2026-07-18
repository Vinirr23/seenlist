import { NextResponse } from "next/server";
import { getMovieDetails } from "@/lib/tmdb/client";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const details = await getMovieDetails(id);
    return NextResponse.json(details);
  } catch (error) {
    // TASK-172 (achado real — dois filmes sem capa/nome que davam
    // erro genérico ao abrir) — antes só logava aqui no servidor
    // (Vercel), sem repassar motivo nenhum pro app, que só sabia
    // dizer "falhou". Agora o app recebe a mensagem real também.
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[api/tmdb/movie/${id}] Falha ao carregar detalhes do filme.`, error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
