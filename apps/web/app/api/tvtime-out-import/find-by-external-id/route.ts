import { NextResponse } from "next/server";
import { findByExternalId, type FindByExternalIdResult } from "@/lib/tmdb/client";

interface RequestBody {
  ids: { id: string; source: "tvdb_id" | "imdb_id" }[];
}

const MAX_IDS_PER_REQUEST = 10;

function sanitizeIds(value: unknown): { id: string; source: "tvdb_id" | "imdb_id" }[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is { id: string; source: "tvdb_id" | "imdb_id" } =>
        typeof item === "object" &&
        item !== null &&
        typeof item.id === "string" &&
        item.id.length > 0 &&
        (item.source === "tvdb_id" || item.source === "imdb_id")
    )
    .slice(0, MAX_IDS_PER_REQUEST);
}

/**
 * TASK-027L — mesmo cuidado da TASK-027F: Promise.allSettled, nunca
 * Promise.all. Um ID externo que o TMDB não reconhece (404) não pode
 * derrubar o lote inteiro — isso já causou o "segundo bug" (séries
 * presas em status errado) no importador antigo quando o lote de
 * temporadas usava Promise.all.
 */
export async function POST(request: Request) {
  let body: Partial<RequestBody>;
  try {
    body = (await request.json()) as Partial<RequestBody>;
  } catch (error) {
    console.error("[api/tvtime-out-import/find-by-external-id] Corpo da requisição inválido.", error);
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const ids = sanitizeIds(body.ids);

  const settled = await Promise.allSettled(ids.map((item) => findByExternalId(item.id, item.source)));

  const results: FindByExternalIdResult[] = [];
  const failed: { id: string; source: string }[] = [];
  settled.forEach((outcome, index) => {
    if (outcome.status === "fulfilled") {
      results.push(outcome.value);
    } else {
      const failedItem = ids[index];
      if (failedItem) {
        failed.push(failedItem);
        console.error(
          `[api/tvtime-out-import/find-by-external-id] Falha ao buscar ${failedItem.source}=${failedItem.id} no TMDB — as demais do lote não são afetadas.`,
          outcome.reason
        );
      }
    }
  });

  return NextResponse.json({ results, failed });
}
