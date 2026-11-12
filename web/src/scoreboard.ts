import type { Config, LeaderRow } from "./chain";

export type Summary = {
  bestHuman: number | null;
  bestAi: number | null;
  humans: number;
  agents: number;
  leader: "humans" | "ai" | "tied" | null;
};

/** Humans vs AI from the leaderboard. Scores stay null until official results exist. */
export function summarize(rows: LeaderRow[] | null, hasResults: boolean): Summary | null {
  if (!rows) return null;
  const humans = rows.filter((r) => !r.is_agent);
  const agents = rows.filter((r) => r.is_agent);
  const best = (side: LeaderRow[]) => (hasResults && side.length ? Math.max(...side.map((r) => r.score)) : null);
  const bestHuman = best(humans);
  const bestAi = best(agents);
  const leader =
    bestHuman === null || bestAi === null ? null : bestHuman === bestAi ? "tied" : bestHuman > bestAi ? "humans" : "ai";
  return { bestHuman, bestAi, humans: humans.length, agents: agents.length, leader };
}

/** Reads the whole leaderboard page by page, stopping at the first short page.
 *  A player who saves while we read can shift between pages, so each account is kept once. */
export async function allRows(
  fetchPage: (from: number, limit: number) => Promise<LeaderRow[]>,
  pageSize = 100,
): Promise<LeaderRow[]> {
  const rows: LeaderRow[] = [];
  const seen = new Set<string>();
  for (let from = 0; ; from += pageSize) {
    const page = await fetchPage(from, pageSize);
    for (const row of page) {
      if (!seen.has(row.account_id)) rows.push(row);
      seen.add(row.account_id);
    }
    if (page.length < pageSize) return rows;
  }
}

export function countdown(msLeft: number): { d: string; h: string; m: string; s: string } {
  const t = Math.max(0, Math.floor(msLeft / 1000));
  const two = (n: number) => String(n).padStart(2, "0");
  return { d: two(Math.floor(t / 86_400)), h: two(Math.floor(t / 3600) % 24), m: two(Math.floor(t / 60) % 60), s: two(t % 60) };
}

/** Bar length for "how high this agent ranks it": 1 for #1, 0 when not ranked at all. */
export function rankBarWidth(rank: number | undefined, total: number): number {
  return rank ? Math.max(0, 1 - (rank - 1) / total) : 0;
}

type View = <T>(method: string, args?: object) => Promise<T>;

/** Config and the whole leaderboard, read together; each is null if its call fails. */
export async function readBoard(view: View): Promise<{ config: Config | null; rows: LeaderRow[] | null }> {
  const [config, rows] = await Promise.all([
    view<Config>("get_config").catch(() => null),
    allRows((from, limit) => view<LeaderRow[]>("get_leaderboard", { from_index: from, limit })).catch(() => null),
  ]);
  return { config, rows };
}

/** Wraps `fn` so it runs only when its argument differs from the last call. */
export function onChange<T>(fn: (value: T) => void): (value: T) => void {
  let first = true;
  let last: T;
  return (value) => {
    if (!first && value === last) return;
    first = false;
    last = value;
    fn(value);
  };
}

/** Leaderboard places: equal scores share a place (1, 1, 3). No places until results exist. */
export function places(rows: LeaderRow[], hasResults: boolean): (number | null)[] {
  return rows.map((row) => (hasResults ? rows.findIndex((r) => r.score === row.score) + 1 : null));
}
