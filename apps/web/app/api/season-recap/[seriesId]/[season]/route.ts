import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { getSeasonEpisodesWithOverview, getSeriesSummary, type SeasonEpisodeOverview } from "@/lib/tmdb/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAiProvider } from "@/lib/ai/getAiProvider";
import { SEASON_RECAP_PROMPT_VERSION } from "@/lib/ai/seasonRecapPrompt";

/**
 * TASK (Resumo da Temporada) — ver auditoria completa no projeto
 * (`claude/SEENLIST-AUDITORIA-2026-10-07-resumo-da-temporada.md`).
 *
 * Fluxo (seção 5 da auditoria): cache primeiro (sem TMDB, sem IA) →
 * busca TMDB em pt-BR → fallback en-US só pros episódios insuficientes
 * → cobertura (seção 7: 70% + checagem do finale) → IA (só se
 * cobertura OK) → grava cache → devolve.
 */

const MIN_COVERAGE = 0.7;
const MIN_OVERVIEW_LENGTH = 40;

function isUsableOverview(overview: string): boolean {
  return overview.trim().length >= MIN_OVERVIEW_LENGTH;
}

/**
 * Aplica o fallback pt-BR → en-US ANTES de calcular cobertura (decisão
 * explícita do usuário — seção 7 da auditoria). Só busca en-US se pelo
 * menos um episódio precisar (evita uma 2ª chamada ao TMDB quando
 * pt-BR já basta pra todos).
 */
async function fetchEpisodesWithFallback(seriesId: string, seasonNumber: number): Promise<SeasonEpisodeOverview[]> {
  const ptEpisodes = await getSeasonEpisodesWithOverview(seriesId, seasonNumber, "pt-BR");
  const needsFallback = ptEpisodes.some((ep) => !isUsableOverview(ep.overview));
  if (!needsFallback) return ptEpisodes;

  const enEpisodes = await getSeasonEpisodesWithOverview(seriesId, seasonNumber, "en-US");
  const enByNumber = new Map(enEpisodes.map((ep) => [ep.episodeNumber, ep]));

  return ptEpisodes.map((ep) => {
    if (isUsableOverview(ep.overview)) return ep;
    const fallback = enByNumber.get(ep.episodeNumber);
    return fallback && isUsableOverview(fallback.overview) ? fallback : ep;
  });
}

function computeSourceHash(episodes: SeasonEpisodeOverview[]): string {
  const concatenated = episodes
    .slice()
    .sort((a, b) => a.episodeNumber - b.episodeNumber)
    .map((ep) => `${ep.episodeNumber}:${ep.overview}`)
    .join("|");
  return createHash("sha256").update(concatenated).digest("hex");
}

interface SeasonRecapRow {
  in_thirty_seconds: string;
  key_events: string;
  where_it_ended: string | null;
}

export async function GET(request: Request, { params }: { params: Promise<{ seriesId: string; season: string }> }) {
  const { seriesId, season } = await params;
  const { searchParams } = new URL(request.url);
  const language = searchParams.get("language") || "pt-BR";

  const tmdbId = Number(seriesId);
  const seasonNumber = Number(season);
  if (!Number.isInteger(tmdbId) || tmdbId <= 0 || !Number.isInteger(seasonNumber) || seasonNumber <= 0) {
    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
  }

  const admin = createAdminClient();

  // 1. Cache primeiro — sem TMDB, sem IA, se já existe uma linha.
  //
  // LIMITAÇÃO CONHECIDA (documentada, não escondida — ver comentário
  // em `source_hash` na migration): esta leitura não recalcula e
  // compara o hash contra o TMDB a cada chamada — isso exigiria buscar
  // no TMDB antes de toda leitura de cache, o que anularia o ganho de
  // ter cache. Se o TMDB atualizar o overview de um episódio depois do
  // recap já gerado, esta linha não se auto-invalida.
  const { data: cached, error: cacheReadError } = await admin
    .from("season_recaps")
    .select("in_thirty_seconds, key_events, where_it_ended")
    .eq("tmdb_id", tmdbId)
    .eq("season_number", seasonNumber)
    .eq("language", language)
    .maybeSingle();

  if (cacheReadError) {
    console.error(`[api/season-recap] Falha ao ler cache de ${tmdbId}/${seasonNumber}/${language}.`, cacheReadError.message);
  }

  if (cached) {
    const row = cached as SeasonRecapRow;
    return NextResponse.json({
      available: true,
      inThirtySeconds: row.in_thirty_seconds,
      keyEvents: row.key_events,
      whereItEnded: row.where_it_ended,
    });
  }

  try {
    // 2. Busca TMDB (com fallback) + nome da série (pro prompt).
    const [episodes, seriesSummary] = await Promise.all([
      fetchEpisodesWithFallback(seriesId, seasonNumber),
      getSeriesSummary(tmdbId, language),
    ]);

    if (episodes.length === 0) {
      return NextResponse.json({ available: false });
    }

    // 3. Cobertura (seção 7): 70% dos episódios com overview utilizável
    // + checagem separada do finale especificamente.
    const usableCount = episodes.filter((ep) => isUsableOverview(ep.overview)).length;
    const coverage = usableCount / episodes.length;
    const finale = episodes.reduce((latest, ep) => (ep.episodeNumber > latest.episodeNumber ? ep : latest));
    const finaleUsable = isUsableOverview(finale.overview);

    if (coverage < MIN_COVERAGE) {
      // Sem dados suficientes — card fica oculto (seção 9), sem chamar
      // IA e sem gravar cache (não é um resultado definitivo: o TMDB
      // pode ganhar mais overviews depois).
      return NextResponse.json({ available: false });
    }

    // 4. Geração de IA — só os overviews coletados acima, nunca dado
    // de usuário (ver `AiProvider`/`SeasonRecapAiInput`, seção de
    // privacidade do tipo).
    const aiProvider = getAiProvider();
    const result = await aiProvider.generateSeasonRecap({
      seriesName: seriesSummary.title,
      seasonNumber,
      episodes: episodes.map((ep) => ({ episodeNumber: ep.episodeNumber, name: ep.name, overview: ep.overview })),
      includeEnding: finaleUsable,
    });

    // 5. Grava cache — falha aqui não derruba a resposta ao usuário
    // (mesma filosofia de `library-summaries/route.ts`).
    const { error: writeError } = await admin.from("season_recaps").upsert(
      {
        tmdb_id: tmdbId,
        season_number: seasonNumber,
        language,
        in_thirty_seconds: result.inThirtySeconds,
        key_events: result.keyEvents,
        where_it_ended: result.whereItEnded,
        source_hash: computeSourceHash(episodes),
        episode_coverage: coverage,
        ai_provider: aiProvider.name,
        prompt_version: SEASON_RECAP_PROMPT_VERSION,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "tmdb_id,season_number,language" }
    );
    if (writeError) {
      console.warn(`[api/season-recap] Falha ao gravar cache de ${tmdbId}/${seasonNumber}/${language}.`, writeError.message);
    }

    return NextResponse.json({
      available: true,
      inThirtySeconds: result.inThirtySeconds,
      keyEvents: result.keyEvents,
      whereItEnded: result.whereItEnded,
    });
  } catch (error) {
    // Erro de rede/TMDB/IA indisponível — card fica oculto (seção 9),
    // nunca quebra a tela de série pro usuário.
    console.error(`[api/season-recap] Falha ao gerar recap de ${tmdbId}/${seasonNumber}/${language}.`, error);
    return NextResponse.json({ available: false });
  }
}
