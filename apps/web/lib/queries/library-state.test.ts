import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchDisplaySummaries } from "./library-state";
import type { MediaSummary } from "@/lib/tmdb/client";

function makeSummary(id: number): MediaSummary {
  return { id, title: `Série ${id}`, year: 2020, posterPath: `/poster-${id}.jpg` };
}

/**
 * TASK-038 — mock que se comporta como a rota REAL de produção se
 * comportaria depois da correção: cada chamada individual nunca
 * recebe mais que 100 ids (se recebesse, isso já seria a rota antiga
 * cortando de novo — o teste falharia por outro motivo, o que é
 * intencional: serve pra flagrar regressão). Devolve um resumo pra
 * cada id recebido, exceto quando o teste pede explicitamente pra
 * simular um id que o TMDB não conhece.
 */
function mockFetchImplementation(options: { missingIds?: Set<number> } = {}) {
  const missingIds = options.missingIds ?? new Set<number>();
  const callBodies: { movieIds: number[]; seriesIds: number[] }[] = [];

  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(init?.body as string) as { movieIds: number[]; seriesIds: number[] };
    callBodies.push(body);

    if (body.movieIds.length > 100 || body.seriesIds.length > 100) {
      throw new Error(
        `Uma chamada recebeu mais de 100 ids (movieIds=${body.movieIds.length}, seriesIds=${body.seriesIds.length}) — a paginação não está fatiando corretamente.`
      );
    }

    const series = body.seriesIds.filter((id) => !missingIds.has(id)).map(makeSummary);
    const movies = body.movieIds.filter((id) => !missingIds.has(id)).map(makeSummary);

    return {
      ok: true,
      status: 200,
      json: async () => ({ movies, series }),
    } as Response;
  });

  return { fetchMock, callBodies };
}

describe("fetchDisplaySummaries — paginação (TASK-038)", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  const sizes = [50, 100, 101, 250, 450, 1000];

  for (const size of sizes) {
    it(`biblioteca com ${size} séries — devolve exatamente ${size} resumos, nenhum descartado`, async () => {
      const { fetchMock } = mockFetchImplementation();
      global.fetch = fetchMock as unknown as typeof fetch;

      const seriesIds = Array.from({ length: size }, (_, i) => i + 1);
      const result = await fetchDisplaySummaries([], seriesIds);

      expect(Object.keys(result.series)).toHaveLength(size);
      for (const id of seriesIds) {
        expect(result.series[id]).toBeDefined();
        expect(result.series[id].id).toBe(id);
      }
    });
  }

  it("nunca envia mais de 100 ids numa única chamada, não importa o tamanho da biblioteca", async () => {
    const { fetchMock, callBodies } = mockFetchImplementation();
    global.fetch = fetchMock as unknown as typeof fetch;

    const seriesIds = Array.from({ length: 450 }, (_, i) => i + 1);
    await fetchDisplaySummaries([], seriesIds);

    for (const body of callBodies) {
      expect(body.seriesIds.length).toBeLessThanOrEqual(100);
    }
  });

  it("450 séries geram exatamente 5 chamadas à rota (450 / 100, arredondado pra cima)", async () => {
    const { fetchMock } = mockFetchImplementation();
    global.fetch = fetchMock as unknown as typeof fetch;

    const seriesIds = Array.from({ length: 450 }, (_, i) => i + 1);
    await fetchDisplaySummaries([], seriesIds);

    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("101 séries geram exatamente 2 chamadas (100 + 1) — confirma que não há corte na borda exata do lote", async () => {
    const { fetchMock } = mockFetchImplementation();
    global.fetch = fetchMock as unknown as typeof fetch;

    const seriesIds = Array.from({ length: 101 }, (_, i) => i + 1);
    const result = await fetchDisplaySummaries([], seriesIds);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(Object.keys(result.series)).toHaveLength(101);
  });

  it("nenhuma série duplicada quando o total não é múltiplo exato do tamanho da página", async () => {
    const { fetchMock } = mockFetchImplementation();
    global.fetch = fetchMock as unknown as typeof fetch;

    const seriesIds = Array.from({ length: 250 }, (_, i) => i + 1);
    const result = await fetchDisplaySummaries([], seriesIds);

    const ids = Object.keys(result.series).map(Number);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("quando o TMDB genuinamente não conhece um id, os demais da mesma página continuam voltando normalmente", async () => {
    const { fetchMock } = mockFetchImplementation({ missingIds: new Set([42]) });
    global.fetch = fetchMock as unknown as typeof fetch;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const seriesIds = Array.from({ length: 100 }, (_, i) => i + 1);
    const result = await fetchDisplaySummaries([], seriesIds);

    expect(Object.keys(result.series)).toHaveLength(99);
    expect(result.series[42]).toBeUndefined();
    expect(result.series[41]).toBeDefined();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("filmes e séries são paginados de forma independente, sem se misturar", async () => {
    const { fetchMock } = mockFetchImplementation();
    global.fetch = fetchMock as unknown as typeof fetch;

    const movieIds = Array.from({ length: 150 }, (_, i) => i + 1000);
    const seriesIds = Array.from({ length: 50 }, (_, i) => i + 1);
    const result = await fetchDisplaySummaries(movieIds, seriesIds);

    expect(Object.keys(result.movies)).toHaveLength(150);
    expect(Object.keys(result.series)).toHaveLength(50);
  });

  it("biblioteca vazia não faz nenhuma chamada de rede", async () => {
    const { fetchMock } = mockFetchImplementation();
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchDisplaySummaries([], []);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({ movies: {}, series: {} });
  });
});
