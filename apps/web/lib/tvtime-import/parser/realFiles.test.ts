import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parseFollowedShows } from "./followedShow";
import { parseTvShowProgress } from "./tvShowProgress";
import { parseSpecialStatus, isForLaterStatus } from "./specialStatus";
import { parseGranularEpisodes } from "./granularEpisodes";

const fixturesDir = join(__dirname, "../__fixtures__");
const read = (name: string) => readFileSync(join(fixturesDir, name), "utf-8");

describe("parseFollowedShows", () => {
  it("extrai tv_show_id e tv_show_name", () => {
    const shows = parseFollowedShows(read("followed_tv_show.csv"));
    expect(shows).toHaveLength(5);
    expect(shows.find((s) => s.name === "Breaking Bad")?.tvShowId).toBe("1001");
  });
});

describe("parseTvShowProgress", () => {
  it("extrai nb_episodes_seen e is_favorited", () => {
    const rows = parseTvShowProgress(read("user_tv_show_data.csv"));
    const office = rows.find((r) => r.name === "The Office (US)");
    expect(office?.totalWatchEvents).toBe(195);

    const friends = rows.find((r) => r.name === "Friends");
    expect(friends?.isFavorite).toBe(true);
    expect(friends?.totalWatchEvents).toBe(0);
  });
});

describe("parseSpecialStatus", () => {
  it("reconhece o status for_later", () => {
    const rows = parseSpecialStatus(read("user_show_special_status.csv"));
    expect(rows).toHaveLength(1);
    expect(isForLaterStatus(rows[0].status)).toBe(true);
  });

  it("não reconhece um status diferente como for_later", () => {
    expect(isForLaterStatus("archived")).toBe(false);
  });
});

describe("parseGranularEpisodes", () => {
  it("extrai temporada e episódio diretamente", () => {
    const rows = parseGranularEpisodes(read("watched_on_episode.csv"));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ tvShowName: "Breaking Bad", seasonNumber: 1, episodeNumber: 1 });
  });
});
