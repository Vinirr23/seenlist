import { fetchLibraryItems } from "@/lib/queries/library-state";

export interface PosterDiagnosticRow {
  title: string;
  tmdb_id: number;
  tvdb_id: string | null;
  poster_path_saved_in_db: null;
  backdrop_path_saved_in_db: null;
  poster_path_from_live_tmdb: string | null;
  status: string;
  has_media_cache_record: false;
  media_cache_incomplete: null;
  probable_cause: string;
}

export interface PosterDiagnosticReport {
  generated_at: string;
  architectural_note: string;
  summary: {
    total_series: number;
    with_cover: number;
    without_cover: number;
    causes: Record<string, number>;
  };
  rows: PosterDiagnosticRow[];
}

/**
 * TASK-036 — "Diagnóstico de Capas". Investigação prévia confirmou
 * dois fatos que mudam o que esta ferramenta pode honestamente
 * reportar:
 *
 * 1. Não existe tabela `media_cache` neste projeto — busquei em todo
 *    o código e não há nenhuma ocorrência. `poster_path` nunca é
 *    gravado em `series_status` nem em nenhuma outra tabela — é
 *    sempre buscado AO VIVO do TMDB a cada carregamento da
 *    Biblioteca (`fetchLibraryItems()` → `MediaSummary.posterPath`).
 *    Por isso os campos "salvo no banco"/"existe media_cache" vêm
 *    sempre `null`/`false` — não é a ferramenta escondendo dado, é
 *    a arquitetura real não ter onde esse dado viveria.
 *
 * 2. `backdropPath` só existe na página de detalhe da série/filme —
 *    o resumo leve usado pela Biblioteca (`MediaSummary`) nunca
 *    busca isso. Por isso também não entra na comparação de capa da
 *    Biblioteca.
 *
 * Dado isso, a comparação que sobra — e que É real — é: o que
 * `fetchLibraryItems()` (a função de verdade da tela) devolve como
 * `posterPath` VERSUS o que uma busca fresca, agora, direto no TMDB
 * pro mesmo tmdb_id devolve. Se as duas baterem e ambas forem nulas,
 * a causa é "TMDB sem poster" (não é bug). Se a busca fresca tiver
 * poster mas a Biblioteca não, a causa está no caminho de busca em
 * lote da Biblioteca.
 */
export async function runPosterDiagnostic(
  onProgress?: (current: number, total: number) => void
): Promise<PosterDiagnosticReport> {
  const libraryItems = await fetchLibraryItems();
  const seriesItems = libraryItems.filter((i) => i.mediaType === "series");

  const rows: PosterDiagnosticRow[] = [];
  const withCover: string[] = [];
  const withoutCover: string[] = [];

  for (let i = 0; i < seriesItems.length; i++) {
    const item = seriesItems[i];
    if (!item) continue;
    onProgress?.(i + 1, seriesItems.length);

    if (item.posterPath) {
      withCover.push(item.title);
      continue;
    }

    withoutCover.push(item.title);

    let freshPosterPath: string | null = null;
    let fetchFailed = false;
    try {
      const response = await fetch("/api/tmdb/library-summaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movieIds: [], seriesIds: [item.id] }),
      });
      if (response.ok) {
        const data = (await response.json()) as { series: { id: number; posterPath: string | null }[] };
        const found = data.series.find((s) => s.id === item.id);
        freshPosterPath = found?.posterPath ?? null;
        if (!found) fetchFailed = true;
      } else {
        fetchFailed = true;
      }
    } catch {
      fetchFailed = true;
    }

    let probableCause: string;
    if (fetchFailed) {
      probableCause = "Busca isolada ao TMDB falhou (rede/timeout) — não dá pra confirmar se o TMDB tem poster.";
    } else if (freshPosterPath === null) {
      probableCause = "TMDB sem poster (busca fresca direto no TMDB também retorna nulo).";
    } else {
      probableCause =
        "TMDB TEM poster (confirmado agora), mas a Biblioteca não mostrou — divergência no caminho de busca em lote (fetchLibraryItems/library-summaries), não falta de dado no TMDB.";
    }

    rows.push({
      title: item.title,
      tmdb_id: item.id,
      tvdb_id: null,
      poster_path_saved_in_db: null,
      backdrop_path_saved_in_db: null,
      poster_path_from_live_tmdb: freshPosterPath,
      status: item.status,
      has_media_cache_record: false,
      media_cache_incomplete: null,
      probable_cause: probableCause,
    });
  }

  const causeCounts: Record<string, number> = {};
  for (const row of rows) {
    causeCounts[row.probable_cause] = (causeCounts[row.probable_cause] ?? 0) + 1;
  }

  return {
    generated_at: new Date().toISOString(),
    architectural_note:
      "Este projeto não tem tabela media_cache, e poster_path nunca é persistido em series_status — é sempre buscado ao vivo do TMDB a cada carregamento. Os campos 'salvo no banco' e 'media_cache' são sempre null/false por isso, não por falha desta ferramenta.",
    summary: {
      total_series: seriesItems.length,
      with_cover: withCover.length,
      without_cover: withoutCover.length,
      causes: causeCounts,
    },
    rows,
  };
}

export function downloadPosterDiagnosticReport(report: PosterDiagnosticReport): void {
  const json = JSON.stringify(report, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `poster-diagnostic-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
