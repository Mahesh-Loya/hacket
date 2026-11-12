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

import { pickOptions } from "./picks";
import type { Project } from "./projects";

describe("pickOptions", () => {
  const p = (id: string, name: string, tracks: string[]): Project => ({ id, name, url: "", tracks, summary: "" });
  const projects = [p("b", "Bravo", ["games"]), p("a", "Alpha", ["games"]), p("n", "Nope", ["defi"])];

  it("lists projects tagged with the track, sorted by name, with an empty choice first", () => {
    expect(pickOptions("games", projects, "")).toEqual([
      { value: "", text: "—" },
      { value: "a", text: "Alpha" },
      { value: "b", text: "Bravo" },
    ]);
  });
  it("grand lists every project", () => {
    expect(pickOptions("grand", projects, "").length).toBe(4);
  });
  it("keeps a saved pick that is not in the list so updating doesn't silently drop it", () => {
    const opts = pickOptions("games", projects, "zzzzzzzz-gone");
    expect(opts[1]).toEqual({ value: "zzzzzzzz-gone", text: "Unknown project (zzzzzzzz…)" });
  });
});
