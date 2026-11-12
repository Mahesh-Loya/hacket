import { describe, expect, it } from "vitest";
import { CATEGORY_ORDER, consensusRows, featuredRows, pickedBy, stripItems } from "./consensus";
import type { AgentOut } from "./projects";

const out = (picks: Record<string, string[]>): AgentOut => ({
  picks: Object.entries(picks).map(([category, ids]) => ({ category, ids })),
  reasons: {},
  scores: {},
});

const agents: Record<string, AgentOut> = {
  screener: out({ grand: ["g1"], defi: ["k", "x"], thesis: ["a"], games: ["p1"], social: ["s"] }),
  mechanist: out({ grand: ["g2"], defi: ["k"], thesis: ["a"], games: ["p2"], social: ["s"] }),
  builder: out({ grand: ["g3"], defi: ["k"], thesis: ["b"], games: ["p3"] }),
  hype: out({ grand: ["g4"], defi: ["y", "k"], thesis: ["b"], games: ["p4"] }),
  contrarian: out({ grand: ["g5"], defi: ["z"], thesis: ["c"], games: ["p5"], social: ["k"] }),
};

const row = (cat: string) => consensusRows(agents).find((r) => r.category === cat)!;

describe("consensusRows", () => {
  it("covers every category, grand first", () => {
    const rows = consensusRows(agents);
    expect(rows.map((r) => r.category)).toEqual(CATEGORY_ORDER);
    expect(CATEGORY_ORDER[0]).toBe("grand");
    expect(CATEGORY_ORDER).toHaveLength(14);
  });

  it("marks 3 matching #1 picks as agreement", () => {
    expect(row("defi")).toMatchObject({ leaders: ["k"], count: 3, agree: true });
  });

  it("lists every project in a tie and gives no agreement", () => {
    expect(row("thesis")).toMatchObject({ leaders: ["a", "b"], count: 2, agree: false });
  });

  it("has no leaders when all agents differ", () => {
    expect(row("games")).toMatchObject({ leaders: [], count: 1, agree: false });
  });

  it("uses null for an agent with no pick in a category", () => {
    expect(row("social").top.builder).toBeNull();
    expect(row("social")).toMatchObject({ leaders: ["s"], count: 2, agree: false });
  });
});

describe("featuredRows", () => {
  it("puts grand first, then strongest agreement, ties in track order", () => {
    const cats = featuredRows(consensusRows(agents)).map((r) => r.category);
    expect(cats).toEqual(["grand", "defi", "thesis", "social", "games"]);
  });
});

describe("pickedBy", () => {
  it("counts each agent once per project", () => {
    const k = pickedBy(agents).find((p) => p.id === "k");
    expect(k).toEqual({ id: "k", agents: 5 });
    expect(pickedBy(agents)[0].id).toBe("k");
  });
});

describe("stripItems", () => {
  it("lists all categories, then the most-picked projects", () => {
    const items = stripItems(agents, 6);
    expect(items).toHaveLength(14 + 6);
    expect(items.slice(0, 14).every((i) => i.kind === "category")).toBe(true);
    expect(items[14]).toEqual({ kind: "project", id: "k", agents: 5 });
  });
});
