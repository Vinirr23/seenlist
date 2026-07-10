import { parseCsv, firstColumn } from "./csv";

export interface RawSpecialStatus {
  tvShowId: string;
  status: string;
}

const ID_ALIASES = ["tv_show_id"];
const STATUS_ALIASES = ["status"];

/**
 * TASK-027B — user_show_special_status.csv. Valor confirmado por
 * inspeção real: "for_later" (ver /docs/tvtime-gdpr-spec.md) —
 * comparação exata, sem variação frouxa, porque este é um dos poucos
 * campos deste export com valor 100% confirmado por observação
 * direta, não por suposição.
 */
export function parseSpecialStatus(csvContent: string): RawSpecialStatus[] {
  const { rows } = parseCsv(csvContent);
  return rows
    .map((row) => {
      const tvShowId = firstColumn(row, ID_ALIASES);
      const status = firstColumn(row, STATUS_ALIASES);
      if (!tvShowId || !status) return null;
      return { tvShowId, status };
    })
    .filter((entry): entry is RawSpecialStatus => entry !== null);
}

export function isForLaterStatus(status: string): boolean {
  return status === "for_later";
}
