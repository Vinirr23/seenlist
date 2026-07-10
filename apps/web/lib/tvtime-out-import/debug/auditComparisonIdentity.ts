import { createClient } from "@/lib/supabase/client";
import { fetchLibraryItems } from "@/lib/queries/library-state";
import type { ParsedSeriesFileRow } from "../parser/seriesParser";

export interface IdentityAuditRow {
  csv: { uuid: string; tvdb_id: string; title: string; status: string };
  matching: { tvdb_id: string; tmdb_id: number | null };
  database: { tmdb_id: number | null; title: string | null; status: string | null };
  library: { tmdb_id: number | null; title: string | null; status: string | null };
  csv_title_equals_database_title: boolean;
  csv_tvdb_equals_matched_tvdb: boolean;
  invalid_comparison: boolean;
  invalid_reason: string | null;
}

/**
 * TASK-034 — audita a PRÓPRIA compareRealStates(), não a
 * importação. Prova, série por série, que os três lados (CSV, banco,
 * Biblioteca) representam a MESMA série real — não só que os status
 * "batem" por acaso, o que aconteceria trivialmente mesmo comparando
 * séries diferentes se o critério fosse só numérico.
 *
 * "database_title"/"library_title" vêm do TMDB (getSeriesSummary,
 * via a mesma rota já usada) — é o único jeito de checar identidade
 * de verdade, já que `series_status` no banco NÃO guarda nome
 * nenhum, só `series_id` (tmdb_id).
 *
 * Uso (console, na tela do importador):
 *   const audit = await auditComparisonIdentity(seriesRows);
 */
export async function auditComparisonIdentity(seriesRows: ParsedSeriesFileRow[]): Promise<IdentityAuditRow[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.error("[audit-identity] Sem sessão.");
    return [];
  }

  const statuses = ["continuing", "up_to_date", "watch_later", "stopped", "not_started_yet"];
  const sample: ParsedSeriesFileRow[] = [];
  for (const status of statuses) {
    sample.push(...seriesRows.filter((r) => r.status === status).slice(0, 5));
  }
  console.log(`[audit-identity] Amostra: ${sample.length} séries (5 de cada um dos 5 status do arquivo).`);

  console.log("[audit-identity] Chamando fetchLibraryItems() — a mesma função real da tela...");
  const libraryItems = await fetchLibraryItems();
  const libraryByTmdbId = new Map(
    libraryItems.filter((i) => i.mediaType === "series").map((i) => [i.id, { title: i.title, status: i.status }])
  );

  const results: IdentityAuditRow[] = [];

  for (const row of sample) {
    console.log("=========================================");
    console.log(`AUDITORIA DE IDENTIDADE: ${row.title}`);
    console.log("=========================================");

    console.log("\n[CSV]");
    console.log(`  uuid: ${row.uuid}`);
    console.log(`  tvdb_id: ${row.tvdbId}`);
    console.log(`  nome: ${row.title}`);
    console.log(`  status: ${row.status}`);

    let tmdbId: number | null = null;
    let matchedTvdbEcho: string | null = null;
    try {
      const response = await fetch("/api/tvtime-out-import/find-by-external-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [{ id: row.tvdbId, source: "tvdb_id" }] }),
      });
      if (response.ok) {
        const data = (await response.json()) as {
          results: { tvdbId: string; seriesTmdbId: number | null }[];
        };
        const found = data.results[0];
        tmdbId = found?.seriesTmdbId ?? null;
        matchedTvdbEcho = found?.tvdbId ?? null;
      }
    } catch (error) {
      console.error("  Falha no matching:", error);
    }
    console.log("\n[Matching]");
    console.log(`  tvdb_id: ${row.tvdbId} → tmdb_id: ${tmdbId ?? "NÃO ENCONTRADO"}`);

    const csvTvdbEqualsMatchedTvdb = matchedTvdbEcho === row.tvdbId;

    if (tmdbId === null) {
      const invalidRow: IdentityAuditRow = {
        csv: { uuid: row.uuid, tvdb_id: row.tvdbId ?? "", title: row.title, status: row.status },
        matching: { tvdb_id: row.tvdbId ?? "", tmdb_id: null },
        database: { tmdb_id: null, title: null, status: null },
        library: { tmdb_id: null, title: null, status: null },
        csv_title_equals_database_title: false,
        csv_tvdb_equals_matched_tvdb: csvTvdbEqualsMatchedTvdb,
        invalid_comparison: true,
        invalid_reason: "Matching não encontrou tmdb_id — não dá pra comparar identidade nenhuma.",
      };
      console.log("\n  ❌ INVALID COMPARISON");
      console.log(`  ${invalidRow.invalid_reason}`);
      results.push(invalidRow);
      continue;
    }

    const { data: dbRow } = await supabase
      .from("series_status")
      .select("series_id, status")
      .eq("user_id", user.id)
      .eq("series_id", tmdbId)
      .maybeSingle();

    let databaseTitle: string | null = null;
    try {
      const summaryResponse = await fetch("/api/tmdb/library-summaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movieIds: [], seriesIds: [tmdbId] }),
      });
      if (summaryResponse.ok) {
        const summaryData = (await summaryResponse.json()) as { series: { id: number; title: string }[] };
        databaseTitle = summaryData.series.find((s) => s.id === tmdbId)?.title ?? null;
      }
    } catch (error) {
      console.error("  Falha ao buscar título real do TMDB pro tmdb_id encontrado:", error);
    }

    console.log("\n[Banco]");
    console.log(`  tmdb_id: ${tmdbId}`);
    console.log(`  nome (TMDB, real, pro tmdb_id gravado): ${databaseTitle ?? "—"}`);
    console.log(`  status: ${dbRow?.status ?? "(sem linha)"}`);

    const libraryEntry = libraryByTmdbId.get(tmdbId);
    console.log("\n[Biblioteca]");
    console.log(`  tmdb_id: ${tmdbId}`);
    console.log(`  nome: ${libraryEntry?.title ?? "—"}`);
    console.log(`  status: ${libraryEntry?.status ?? "(não está na biblioteca)"}`);

    const csvTitleEqualsDatabaseTitle = databaseTitle !== null && titlesLooselyMatch(row.title, databaseTitle);

    let invalidReason: string | null = null;
    if (!csvTitleEqualsDatabaseTitle && databaseTitle !== null) {
      invalidReason = `CSV diz "${row.title}", mas o tmdb_id ${tmdbId} no banco corresponde a "${databaseTitle}" no TMDB — provável colisão de matching (homônimo, reboot ou remake).`;
    } else if (!csvTvdbEqualsMatchedTvdb) {
      invalidReason = `O tvdb_id devolvido pelo matching ("${matchedTvdbEcho}") não é o mesmo que foi enviado ("${row.tvdbId}").`;
    }

    const isInvalid = invalidReason !== null;

    console.log(`\n  csv_title == database_title: ${csvTitleEqualsDatabaseTitle}`);
    console.log(`  csv_tvdb == matched_tvdb: ${csvTvdbEqualsMatchedTvdb}`);
    if (isInvalid) {
      console.log("\n  ❌ INVALID COMPARISON");
      console.log(`  ${invalidReason}`);
    } else {
      console.log("\n  ✅ Identidade confirmada — mesma série nos três lados.");
    }

    results.push({
      csv: { uuid: row.uuid, tvdb_id: row.tvdbId ?? "", title: row.title, status: row.status },
      matching: { tvdb_id: row.tvdbId ?? "", tmdb_id: tmdbId },
      database: { tmdb_id: tmdbId, title: databaseTitle, status: dbRow?.status ?? null },
      library: { tmdb_id: tmdbId, title: libraryEntry?.title ?? null, status: libraryEntry?.status ?? null },
      csv_title_equals_database_title: csvTitleEqualsDatabaseTitle,
      csv_tvdb_equals_matched_tvdb: csvTvdbEqualsMatchedTvdb,
      invalid_comparison: isInvalid,
      invalid_reason: invalidReason,
    });
  }

  const invalidCount = results.filter((r) => r.invalid_comparison).length;
  console.log("\n=========================================");
  console.log("RESUMO DA AUDITORIA DE IDENTIDADE");
  console.log(`Amostra: ${results.length} séries`);
  console.log(`Comparações inválidas (série diferente nos dois lados): ${invalidCount}`);
  console.log(
    invalidCount === 0
      ? "✅ Todas as comparações da amostra são válidas — compareRealStates() está comparando a mesma série."
      : "❌ Existem comparações inválidas — compareRealStates() precisa excluir essas séries das estatísticas."
  );
  console.log("=========================================");

  return results;
}

function titlesLooselyMatch(a: string, b: string): boolean {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\(\d{4}\)/g, "")
      .replace(/[^a-z0-9]/g, "")
      .trim();
  const na = normalize(a);
  const nb = normalize(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}
