import { describe, expect, it } from "vitest";
import type { AgentOut, Data, Project } from "./projects";
import { filterRankings, projectRankings } from "./rankings";

const proj = (id: string, name: string): Project => ({ id, name, url: "", tracks: ["games"], summary: "" });
const out = (scores: Record<string, number>, picked: string[] = []): AgentOut => ({
  picks: picked.length ? [{ category: "games", ids: picked }] : [],
  reasons: {},
  scores,
});

const projects = [proj("a", "Alpha"), proj("b", "Beta"), proj("c", "Gamma"), proj("d", "Delta")];
const data: Data = {
  projects,
  byId: new Map(projects.map((p) => [p.id, p])),
  agents: {
    // a: ranks 1,2 → 1.5 · b: 2,1 → 1.5 · c: 3,3 → 3 · d: only one agent ranks it (#4) → 4
    screener: out({ a: 9, b: 8, c: 7, d: 1 }, ["a"]),
    mechanist: out({ a: 8, b: 9, c: 7 }, ["b", "a"]),
  },
};

describe("projectRankings", () => {
  const rows = projectRankings(data);

  it("orders by average judge rank, sharing a place on ties", () => {
    expect(rows.map((r) => [r.id, r.place])).toEqual([["a", 1], ["b", 1], ["c", 3], ["d", 4]]);
    expect(rows[0].avg).toBe(1.5);
  });

  it("keeps each judge's own rank, and none where a judge didn't rank it", () => {
    expect(rows[0].ranks).toEqual({ screener: 1, mechanist: 2 });
    expect(rows[3].ranks).toEqual({ screener: 4, mechanist: undefined });
  });

  it("counts how many agents picked the project", () => {
    expect(rows.find((r) => r.id === "a")?.pickedBy).toBe(2);
    expect(rows.find((r) => r.id === "c")?.pickedBy).toBe(0);
  });

  it("puts projects no judge ranked at the end", () => {
    const extra = { ...data, projects: [...projects, proj("z", "Zed")], byId: new Map([...data.byId, ["z", proj("z", "Zed")]]) };
    const last = projectRankings(extra).at(-1)!;
    expect(last).toMatchObject({ id: "z", avg: null, place: null });
  });
});

describe("filterRankings", () => {
  it("matches names case-insensitively and keeps overall places", () => {
    const got = filterRankings(projectRankings(data), "GAM", data.byId);
    expect(got.map((r) => [r.id, r.place])).toEqual([["c", 3]]);
  });

  it("returns everything for an empty search", () => {
    expect(filterRankings(projectRankings(data), "  ", data.byId)).toHaveLength(4);
  });
});
