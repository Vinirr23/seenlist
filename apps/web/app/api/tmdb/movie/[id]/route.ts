import { NextResponse } from "next/server";
import { getMovieDetails } from "@/lib/tmdb/client";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const details = await getMovieDetails(id);
    return NextResponse.json(details);
  } catch {
    return NextResponse.json({ error: "Não foi possível carregar o filme agora." }, { status: 502 });
  }
}
