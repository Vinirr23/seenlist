import JSZip from "jszip";

/**
 * TASK-027M — nomes confirmados contra um export real: os arquivos
 * vêm com sufixo de data (`tvtime-series-2026-07-06.csv`), não o
 * nome exato citado na tarefa (`tvtime-series.csv`). Por isso o
 * casamento aqui é por PREFIXO, não igualdade — outra data de export
 * não pode quebrar a extração.
 */
export const KNOWN_FILE_PREFIXES = {
  series: "tvtime-series-",
  episodes: "tvtime-series-episodes-",
  movies: "tvtime-movies-",
  summary: "tvtime-summary-",
} as const;

export type KnownTvTimeOutFile = keyof typeof KNOWN_FILE_PREFIXES;

export interface ExtractedTvTimeOutArchive {
  files: Partial<Record<KnownTvTimeOutFile, string>>;
  allFileNames: string[];
  /** TASK-027N — "verificar se o importador realmente está usando tvtime-series.csv" — nome real do arquivo encontrado dentro do zip, não o nome do zip em si. */
  matchedFileNames: Partial<Record<KnownTvTimeOutFile, string>>;
  exportDate: string | null;
}

function baseName(path: string): string {
  return path.split("/").pop() ?? path;
}

function extractExportDateFromSummaryHtml(html: string): string | null {
  const labeled = html.match(/Export date<\/span>\s*<span[^>]*>(\d{4}-\d{2}-\d{2})/);
  if (labeled) return labeled[1] ?? null;
  return null;
}

function extractExportDateFromFileName(name: string): string | null {
  const match = name.match(/(\d{4}-\d{2}-\d{2})\.csv$/);
  return match ? (match[1] ?? null) : null;
}

export async function extractTvTimeOutArchive(zipFile: File): Promise<ExtractedTvTimeOutArchive> {
  const zip = await JSZip.loadAsync(zipFile);
  const allFileNames: string[] = [];
  const files: Partial<Record<KnownTvTimeOutFile, string>> = {};
  const matchedFileNames: Partial<Record<KnownTvTimeOutFile, string>> = {};
  let fileNameDateFallback: string | null = null;

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const name = baseName(path);
    allFileNames.push(name);
    const lower = name.toLowerCase();

    if (lower.startsWith(KNOWN_FILE_PREFIXES.episodes)) {
      files.episodes = await entry.async("string");
      matchedFileNames.episodes = name;
      fileNameDateFallback ??= extractExportDateFromFileName(name);
    } else if (lower.startsWith(KNOWN_FILE_PREFIXES.series)) {
      files.series = await entry.async("string");
      matchedFileNames.series = name;
      fileNameDateFallback ??= extractExportDateFromFileName(name);
    } else if (lower.startsWith(KNOWN_FILE_PREFIXES.movies)) {
      files.movies = await entry.async("string");
      matchedFileNames.movies = name;
      fileNameDateFallback ??= extractExportDateFromFileName(name);
    } else if (lower.startsWith(KNOWN_FILE_PREFIXES.summary)) {
      files.summary = await entry.async("string");
      matchedFileNames.summary = name;
    }
  }

  const exportDate = (files.summary ? extractExportDateFromSummaryHtml(files.summary) : null) ?? fileNameDateFallback;

  return { files, allFileNames, matchedFileNames, exportDate };
}
