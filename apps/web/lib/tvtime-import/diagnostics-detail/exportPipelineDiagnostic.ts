import type { FullPipelineTrace } from "../diagnostics-detail/fullPipelineAudit";

/**
 * TASK-027L — "muito menor e vai direto ao problema" que um HAR
 * completo. Reaproveita o mesmo `FullPipelineTrace` já calculado
 * durante a importação (TASK-027K) — nada novo é computado aqui, só
 * reorganizado nos grupos exatos pedidos, pra não precisar copiar
 * console nem exportar rede.
 */
export interface PipelineDiagnosticEntry {
  gdpr: {
    nome: string;
    nb_episodes_seen: number;
    for_later: boolean;
    favorito: boolean;
    episodios_granulares_conhecidos: number;
  };
  matching: {
    tmdbId: number | null;
    titulo_encontrado: string | null;
    score: number | null;
    motivo: string;
  };
  tmdb: {
    temporadas: number | null;
    temporadas_ignoradas_especiais: number | null;
    episodios_principais: number | null;
  };
  uniqueEpisodesSeen: number | null;
  totalWatchEvents: number;
  status_calculado: {
    valor: string | null;
    regra: string | null;
  };
  status_gravado: {
    valor: string | null;
    episodios_enviados: number | null;
    favorito_enviado: boolean | null;
    pulado_por_idempotencia: boolean;
  };
  status_lido_do_banco: {
    valor: string | null;
    episodios_lidos: number | null;
    favorito_lido: boolean | null;
  };
  primeira_divergencia: {
    etapa: string | null;
    detalhe: string | null;
  };
}

function toEntry(t: FullPipelineTrace): PipelineDiagnosticEntry {
  return {
    gdpr: {
      nome: t.rawName,
      nb_episodes_seen: t.nbEpisodesSeen,
      for_later: t.isExplicitlyForLater,
      favorito: t.isFavoriteRaw,
      episodios_granulares_conhecidos: t.knownEpisodesCount,
    },
    matching: {
      tmdbId: t.tmdbId,
      titulo_encontrado: t.matchedTitle,
      score: t.matchScore,
      motivo: t.matchReason,
    },
    tmdb: {
      temporadas: t.tmdbNumberOfSeasons,
      temporadas_ignoradas_especiais: t.seasonsIgnored,
      episodios_principais: t.tmdbTotalMainEpisodes,
    },
    uniqueEpisodesSeen: t.uniqueEpisodesSeen,
    totalWatchEvents: t.totalWatchEvents,
    status_calculado: {
      valor: t.statusCalculated,
      regra: t.statusRule,
    },
    status_gravado: {
      valor: t.writtenStatus,
      episodios_enviados: t.writtenEpisodeCount,
      favorito_enviado: t.writtenFavorite,
      pulado_por_idempotencia: t.wasSkippedByIdempotency,
    },
    status_lido_do_banco: {
      valor: t.readBackStatus,
      episodios_lidos: t.readBackEpisodeCount,
      favorito_lido: t.readBackFavorite,
    },
    primeira_divergencia: {
      etapa: t.firstDivergenceStage,
      detalhe: t.divergenceDetail,
    },
  };
}

export function buildPipelineDiagnosticJson(traces: FullPipelineTrace[]): string {
  const entries = traces.map(toEntry);
  const withDivergence = entries.filter((e) => e.primeira_divergencia.etapa !== null);

  const payload = {
    gerado_em: new Date().toISOString(),
    total_series: entries.length,
    series_com_divergencia: withDivergence.length,
    series: entries,
  };

  return JSON.stringify(payload, null, 2);
}

export function downloadPipelineDiagnostic(traces: FullPipelineTrace[]): void {
  const json = buildPipelineDiagnosticJson(traces);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `diagnostico-importacao-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
