import { KNOWN_FILES, type ExtractedArchive } from "../parser/zip";

/**
 * TASK-027B — "followed_tv_show.csv" é o único arquivo indispensável
 * de verdade: sem ele não há biblioteca nenhuma pra importar. Todos
 * os outros (progresso, status especial, episódios granulares) são
 * importantes mas opcionais — a ausência de qualquer um deles
 * degrada a qualidade da reconstrução, nunca impede a importação.
 */
const REQUIRED_FILE = "followed_tv_show.csv";

export interface ValidationResult {
  valid: boolean;
  missingFiles: string[];
  /** true quando o zip existe e tem arquivos, mas nenhum bate com o que esperamos — sinal de formato diferente, não de arquivo corrompido. */
  possibleFormatChange: boolean;
}

export function validateArchive(extracted: ExtractedArchive): ValidationResult {
  const missingFiles = KNOWN_FILES.filter((file) => !extracted.files[file]);
  const valid = Boolean(extracted.files[REQUIRED_FILE]);

  const hasOnlyUnknownFiles =
    !valid &&
    extracted.allFileNames.length > 0 &&
    extracted.allFileNames.every((name) => !name.toLowerCase().endsWith(".csv"));

  return { valid, missingFiles, possibleFormatChange: hasOnlyUnknownFiles };
}
