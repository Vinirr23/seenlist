import JSZip from "jszip";

/**
 * TASK-027B — nomes REAIS, confirmados por inspeção direta de um
 * export de verdade em 05/07/2026 (ver /docs/tvtime-gdpr-spec.md).
 * Isso substitui de vez os nomes "tracking-prod-records*" da
 * TASK-027A, que a inspeção real provou não existirem.
 */
export const KNOWN_FILES = [
  "followed_tv_show.csv",
  "user_tv_show_data.csv",
  "user_show_special_status.csv",
  "show_seen_episode_latest.csv",
  "seen_episode_latest.csv",
  "watched_on_episode.csv",
  "rewatched_episode.csv",
] as const;

export type KnownFileName = (typeof KNOWN_FILES)[number];

export interface ExtractedArchive {
  files: Partial<Record<KnownFileName, string>>;
  /** Todo nome de arquivo encontrado no zip, mesmo os que não usamos (o export real tem ~49 arquivos; a maioria é dado de conta/comentário/analytics irrelevante — ver /docs/tvtime-gdpr-spec.md). */
  allFileNames: string[];
}

function baseName(path: string): string {
  return path.split("/").pop() ?? path;
}

/** Remove extensão e normaliza separador/caixa — tolera pequenas variações de nome sem exigir igualdade exata de string. */
function normalizeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.(csv|json|txt)$/i, "")
    .replace(/[-_\s]+/g, "");
}

export async function extractArchive(zipFile: File): Promise<ExtractedArchive> {
  const zip = await JSZip.loadAsync(zipFile);
  const allFileNames: string[] = [];
  const files: Partial<Record<KnownFileName, string>> = {};

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const name = baseName(path);
    allFileNames.push(name);

    const known = KNOWN_FILES.find((candidate) => normalizeFileName(candidate) === normalizeFileName(name));
    if (known) {
      files[known] = await entry.async("string");
    }
  }

  return { files, allFileNames };
}
