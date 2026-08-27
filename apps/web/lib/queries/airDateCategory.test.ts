import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { decideWatchingVsUpToDate, resolveSeriesCategory, shouldWriteSeriesCategory, type LiveEpisodeAirDate } from "./airDateCategory";

/**
 * Testes de regressão pro bug real corrigido nesta auditoria
 * ("verifique toda a lógica de status, e tenha certeza desses bugs
 * de status nunca acontecerem novamente") — episódio marcado
 * ESPECIAL pelo TV Time (`is_special = true`, pode estar DENTRO de
 * uma temporada normal, não só temporada 0) nunca era excluído do
 * lado do TMDB na hora de decidir "assistiu tudo?", então qualquer
 * série com episódio especial nunca conseguia sair de "watching".
 *
 * `decideWatchingVsUpToDate` usa `new Date()` internamente pra
 * calcular "hoje" — fixamos o relógio do teste pra não depender do
 * dia em que o teste roda.
 *
 * CORREÇÃO (investigação do Bleach, 2026-08-25) — a assinatura mudou
 * de `mainEpisodesWatched: number` pra `watchedEpisodeKeys: Set<string>`
 * (decisão por identidade, não por total agregado — ver comentário
 * grande em `airDateCategory.ts`). Todos os testes abaixo foram
 * convertidos pra passar o Set de episódios de fato assistidos, em
 * vez de só a contagem — e um novo teste (`BUG REAL CORRIGIDO
 * (Bleach)`, no fim) cobre o cenário exato que motivou a correção.
 */
const FIXED_TODAY = new Date("2026-08-20T12:00:00");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_TODAY);
});

afterEach(() => {
  vi.useRealTimers();
});

function ep(seasonNumber: number, episodeNumber: number, airDate: string | null): LiveEpisodeAirDate {
  return { seasonNumber, episodeNumber, airDate };
}

function keys(...pairs: string[]): Set<string> {
  return new Set(pairs);
}

describe("decideWatchingVsUpToDate", () => {
  it("sem episódio especial: todos os já lançados assistidos → up_to_date", () => {
    const episodes = [ep(1, 1, "2026-01-01"), ep(1, 2, "2026-01-08"), ep(1, 3, "2026-01-15")];
    const decision = decideWatchingVsUpToDate(keys("1-1", "1-2", "1-3"), episodes);
    expect(decision.category).toBe("up_to_date");
    expect(decision.nonSpecialEpisodeCount).toBe(3);
    expect(decision.allNonSpecialEpisodesWatched).toBe(true);
  });

  it("sem episódio especial: falta assistir um já lançado → watching", () => {
    const episodes = [ep(1, 1, "2026-01-01"), ep(1, 2, "2026-01-08"), ep(1, 3, "2026-01-15")];
    const decision = decideWatchingVsUpToDate(keys("1-1", "1-2"), episodes);
    expect(decision.category).toBe("watching");
    expect(decision.nonSpecialEpisodeCount).toBe(3);
    expect(decision.allNonSpecialEpisodesWatched).toBe(false);
  });

  it("BUG REAL CORRIGIDO: episódio especial não assistido (dentro de temporada normal) não impede up_to_date/completed", () => {
    // 3 episódios "principais" (já assistidos) + 1 episódio especial
    // (season 1, episode 4) que o usuário nunca marcou como assistido
    // "normal" — cenário exato reportado (Riverdale/Money
    // Heist/Elite etc. presos em "Assistindo" mesmo com tudo
    // relevante assistido).
    const episodes = [ep(1, 1, "2026-01-01"), ep(1, 2, "2026-01-08"), ep(1, 3, "2026-01-15"), ep(1, 4, "2026-01-15")];
    const specialKeys = keys("1-4");
    const watchedKeys = keys("1-1", "1-2", "1-3"); // o episódio 4 (especial) nunca foi marcado.

    // Sem excluir o especial (comportamento ANTES da correção dos especiais): episódio "1-4" conta como pendente → sempre "watching".
    const withoutFix = decideWatchingVsUpToDate(watchedKeys, episodes, new Set());
    expect(withoutFix.category).toBe("watching");

    // Com a correção: o especial é excluído dos dois lados da conta → up_to_date.
    const withFix = decideWatchingVsUpToDate(watchedKeys, episodes, specialKeys);
    expect(withFix.category).toBe("up_to_date");
    expect(withFix.nonSpecialEpisodeCount).toBe(3); // exclui o especial do total também, não só da contagem de "já lançados"
    expect(withFix.allNonSpecialEpisodesWatched).toBe(true);
  });

  it("episódio especial FUTURO (ainda não lançado) não conta nem pra 'aired' nem pro total não-especial", () => {
    const episodes = [ep(1, 1, "2026-01-01"), ep(1, 2, "2026-01-08"), ep(1, 3, "2099-01-01")]; // especial no futuro distante
    const specialKeys = keys("1-3");
    const decision = decideWatchingVsUpToDate(keys("1-1", "1-2"), episodes, specialKeys);
    expect(decision.category).toBe("up_to_date");
    expect(decision.nonSpecialEpisodeCount).toBe(2);
  });

  it("episódio sem airDate conta como 'já saiu' só se a MESMA temporada tiver outro episódio confirmado e passado", () => {
    // Temporada com um episódio confirmado no passado e outro sem data (TMDB atrasado) → conta como já saído.
    const episodesComTemporadaConfirmada = [ep(1, 1, "2026-01-01"), ep(1, 2, null)];
    expect(decideWatchingVsUpToDate(keys("1-1"), episodesComTemporadaConfirmada).category).toBe("watching");

    // Temporada inteira sem nenhuma data confirmada (especulação de futuro) → não conta como já saído.
    const temporadaFutura = [ep(2, 1, null), ep(2, 2, null)];
    expect(decideWatchingVsUpToDate(keys(), temporadaFutura).category).toBe("up_to_date");
  });

  it("múltiplos episódios especiais em temporadas diferentes são todos excluídos", () => {
    const episodes = [
      ep(1, 1, "2026-01-01"),
      ep(1, 5, "2026-01-08"), // especial temporada 1
      ep(2, 1, "2026-01-15"),
      ep(2, 8, "2026-01-15"), // especial temporada 2
    ];
    const specialKeys = keys("1-5", "2-8");
    const decision = decideWatchingVsUpToDate(keys("1-1", "2-1"), episodes, specialKeys);
    expect(decision.category).toBe("up_to_date");
    expect(decision.nonSpecialEpisodeCount).toBe(2);
  });

  it("BUG REAL CORRIGIDO (Bleach): total de 'assistidos' muito maior que o necessário não basta mais sozinho — cada episódio precisa bater por identidade", () => {
    // Cenário real investigado: uma importação bagunçada gravou
    // MUITAS linhas de episódio assistido (numeração absoluta do
    // anime inteiro despejada como se fosse "temporada 1"), inflando
    // o total muito além do necessário — mas um episódio pendente de
    // verdade (temporada 2, episódio 2) nunca foi marcado com a
    // identidade correta. Com a comparação antiga (por total), 8
    // "assistidos" >= 4 episódios reais já teria concluído (errado)
    // "up_to_date".
    const episodes = [ep(1, 1, "2026-01-01"), ep(1, 2, "2026-01-08"), ep(2, 1, "2026-01-15"), ep(2, 2, "2026-01-22")];
    const watchedKeys = keys("1-1", "1-2", "2-1", "9-1", "9-2", "9-3", "9-4", "9-5"); // 8 chaves no total — mais que os 4 episódios reais — mas "2-2" não está entre elas.
    const decision = decideWatchingVsUpToDate(watchedKeys, episodes);
    expect(decision.category).toBe("watching");
    expect(decision.allNonSpecialEpisodesWatched).toBe(false);
  });
});

describe("resolveSeriesCategory", () => {
  it("simula a checagem de 'completed' feita pelos chamadores (série terminada + tudo assistido, com especial de permeio)", () => {
    const episodes = [ep(1, 1, "2026-01-01"), ep(1, 2, "2026-01-08"), ep(1, 3, "2026-01-15")];
    const specialKeys = keys("1-3");
    const watchedKeys = keys("1-1", "1-2"); // assistiu os 2 episódios "principais"; o 3º é especial, nunca marcado.

    const resolution = resolveSeriesCategory({
      watchedEpisodeKeys: watchedKeys,
      liveEpisodes: episodes,
      ended: true,
      specialEpisodeKeys: specialKeys,
    });

    expect(resolution.category).toBe("completed");
  });

  it("BUG REAL CORRIGIDO (Bleach) via resolveSeriesCategory: total inflado não promove 'completed' à toa", () => {
    const episodes = [ep(1, 1, "2026-01-01"), ep(1, 2, "2026-01-08"), ep(2, 1, "2026-01-15"), ep(2, 2, "2026-01-22")];
    const watchedKeys = keys("1-1", "1-2", "2-1", "9-1", "9-2", "9-3", "9-4", "9-5"); // total inflado, mas "2-2" nunca foi marcado.

    const resolution = resolveSeriesCategory({
      watchedEpisodeKeys: watchedKeys,
      liveEpisodes: episodes,
      ended: true, // mesmo com a série encerrada no TMDB...
      specialEpisodeKeys: new Set(),
    });

    expect(resolution.category).toBe("watching"); // ...não promove pra completed, porque "2-2" nunca bateu por identidade.
  });
});

describe("shouldWriteSeriesCategory", () => {
  it("'paused' nunca vira 'watching' sozinho (retomar é decisão manual)", () => {
    expect(shouldWriteSeriesCategory("paused", "watching")).toBe(false);
  });

  it("BUG REAL CORRIGIDO (Primal, 2026-08-26): 'want_to_watch' também não vira 'watching' sozinho", () => {
    // Cenário exato reportado: usuário marcou o Primal manualmente como
    // "Assistir depois" depois de ver as temporadas antigas; rodar
    // "Corrigir status das séries" recalculou e viu episódio novo (T3)
    // ainda não assistido — sem esta proteção, sobrescrevia a escolha
    // manual pra "Assistindo" sozinho.
    expect(shouldWriteSeriesCategory("want_to_watch", "watching")).toBe(false);
  });

  it("'want_to_watch' continua livre pra virar 'up_to_date' ou 'completed' (só o caminho pra 'watching' é protegido)", () => {
    expect(shouldWriteSeriesCategory("want_to_watch", "up_to_date")).toBe(true);
    expect(shouldWriteSeriesCategory("want_to_watch", "completed")).toBe(true);
  });

  it("'watching' sempre é regravado, mesmo sem mudança de categoria (mantém 'updated_at' fresco pro ranking de Continue assistindo)", () => {
    expect(shouldWriteSeriesCategory("watching", "watching")).toBe(true);
  });

  it("categorias sem mudança (fora de 'watching') não são regravadas à toa", () => {
    expect(shouldWriteSeriesCategory("up_to_date", "up_to_date")).toBe(false);
    expect(shouldWriteSeriesCategory("completed", "completed")).toBe(false);
  });
});
