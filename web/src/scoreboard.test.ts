import { describe, expect, it } from "vitest";
import type { LeaderRow } from "./chain";
import { allRows, countdown, onChange, rankBarWidth, readBoard, summarize } from "./scoreboard";

const r = (account_id: string, score: number, is_agent: boolean): LeaderRow => ({ account_id, score, is_agent, updated_ns: "0" });

describe("summarize", () => {
  const rows = [r("builder.hackket.testnet", 9, true), r("alice.testnet", 7, false), r("bob.testnet", 2, false)];

  it("counts humans and agents", () => {
    expect(summarize(rows, true)).toMatchObject({ humans: 2, agents: 1, bestHuman: 7, bestAi: 9, leader: "ai" });
  });

  it("hides scores before results", () => {
    expect(summarize(rows, false)).toEqual({ humans: 2, agents: 1, bestHuman: null, bestAi: null, leader: null });
  });

  it("says tied when the best scores match", () => {
    expect(summarize([r("a.testnet", 5, false), r("hype.hackket.testnet", 5, true)], true)?.leader).toBe("tied");
  });

  it("has no leader when one side has no players", () => {
    expect(summarize([r("hype.hackket.testnet", 5, true)], true)).toMatchObject({ bestHuman: null, leader: null });
  });

  it("returns null when the contract couldn't be read", () => {
    expect(summarize(null, true)).toBeNull();
  });
});

describe("allRows", () => {
  it("pages until a short page", async () => {
    const all = Array.from({ length: 250 }, (_, i) => r(`p${i}.testnet`, 0, false));
    const calls: number[] = [];
    const got = await allRows(async (from, limit) => {
      calls.push(from);
      return all.slice(from, from + limit);
    }, 100);
    expect(got).toHaveLength(250);
    expect(calls).toEqual([0, 100, 200]);
  });
});

describe("countdown", () => {
  it("splits into two-digit parts", () => {
    expect(countdown(90_061_000)).toEqual({ d: "01", h: "01", m: "01", s: "01" });
  });
  it("stops at zero", () => {
    expect(countdown(-5)).toEqual({ d: "00", h: "00", m: "00", s: "00" });
  });
});

describe("rankBarWidth", () => {
  it("is full for #1 and empty when not ranked", () => {
    expect(rankBarWidth(1, 678)).toBe(1);
    expect(rankBarWidth(678, 678)).toBeCloseTo(1 / 678);
    expect(rankBarWidth(undefined, 678)).toBe(0);
  });
});

describe("readBoard", () => {
  it("reads config and every leaderboard page", async () => {
    const calls: string[] = [];
    const got = await readBoard(async <T>(method: string, args: object = {}) => {
      calls.push(method);
      if (method === "get_config") return { has_results: true } as T;
      return ((args as { from_index: number }).from_index === 0 ? [r("a.testnet", 1, false)] : []) as T;
    });
    expect(got.config?.has_results).toBe(true);
    expect(got.rows).toHaveLength(1);
    expect(calls).toContain("get_config");
  });

  it("keeps the leaderboard when config fails, and vice versa", async () => {
    const got = await readBoard(async <T>(method: string) => {
      if (method === "get_config") throw new Error("down");
      return [] as T;
    });
    expect(got).toEqual({ config: null, rows: [] });
  });
});

describe("onChange", () => {
  it("calls only when the value changes", () => {
    const seen: (string | null)[] = [];
    const f = onChange<string | null>((v) => seen.push(v));
    f(null); f(null); f("a.testnet"); f("a.testnet"); f(null);
    expect(seen).toEqual([null, "a.testnet", null]);
  });
});
