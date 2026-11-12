import { describe, expect, it } from "vitest";
import { buildPicks } from "./picks";

describe("buildPicks", () => {
  it("drops empty slots and empty categories, keeps order", () => {
    expect(buildPicks({ games: ["a", "", "b"], nfts: ["", "", ""], grand: ["g"] })).toEqual([
      { category: "games", ids: ["a", "b"] },
      { category: "grand", ids: ["g"] },
    ]);
  });
  it("rejects the same project twice in one category", () => {
    expect(() => buildPicks({ games: ["a", "a", ""] })).toThrow("Games With Real Economies: pick different projects");
  });
  it("rejects an empty selection", () => {
    expect(() => buildPicks({ games: ["", "", ""] })).toThrow("Pick at least one project");
  });
});
