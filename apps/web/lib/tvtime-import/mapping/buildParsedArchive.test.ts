import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { buildParsedArchive } from "./buildParsedArchive";
import type { ExtractedArchive } from "../parser/zip";

const fixturesDir = join(__dirname, "../__fixtures__");
const read = (name: string) => readFileSync(join(fixturesDir, name), "utf-8");

function fakeArchive(): ExtractedArchive {
  return {
    files: {
      "followed_tv_show.csv": read("followed_tv_show.csv"),
      "user_tv_show_data.csv": read("user_tv_show_data.csv"),
      "user_show_special_status.csv": read("user_show_special_status.csv"),
      "watched_on_episode.csv": read("watched_on_episode.csv"),
    },
    allFileNames: [
      "followed_tv_show.csv",
      "user_tv_show_data.csv",
      "user_show_special_status.csv",
      "watched_on_episode.csv",
    ],
  };
}

describe("buildParsedArchive", () => {
  it("combina os arquivos numa lista de ParsedShow", () => {
    const archive = buildParsedArchive(fakeArchive());
    expect(archive.shows).toHaveLength(5);
  });

  it("usa nb_episodes_seen como totalWatchEvents (fonte principal de progresso, TASK-027J)", () => {
    const archive = buildParsedArchive(fakeArchive());
    const office = archive.shows.find((s) => s.name === "The Office (US)");
    expect(office?.totalWatchEvents).toBe(195);
  });

  it("marca isExplicitlyForLater a partir de user_show_special_status.csv", () => {
    const archive = buildParsedArchive(fakeArchive());
    const archer = archive.shows.find((s) => s.name === "Archer");
    expect(archer?.isExplicitlyForLater).toBe(true);
    const smallville = archive.shows.find((s) => s.name === "Smallville");
    expect(smallville?.isExplicitlyForLater).toBe(false);
  });

  it("associa episódios granulares por nome", () => {
    const archive = buildParsedArchive(fakeArchive());
    const breakingBad = archive.shows.find((s) => s.name === "Breaking Bad");
    expect(breakingBad?.knownEpisodes).toHaveLength(2);
  });

  it("marca favoritos independente de status de assistir depois", () => {
    const archive = buildParsedArchive(fakeArchive());
    const friends = archive.shows.find((s) => s.name === "Friends");
    expect(friends?.isFavorite).toBe(true);
    expect(friends?.totalWatchEvents).toBe(0);
  });

  it("nunca lança exceção quando um arquivo opcional está ausente", () => {
    const partial: ExtractedArchive = {
      files: { "followed_tv_show.csv": read("followed_tv_show.csv") },
      allFileNames: ["followed_tv_show.csv"],
    };
    expect(() => buildParsedArchive(partial)).not.toThrow();
    const result = buildParsedArchive(partial);
    expect(result.shows).toHaveLength(5);
    expect(result.shows.every((s) => s.totalWatchEvents === 0)).toBe(true);
  });
});
