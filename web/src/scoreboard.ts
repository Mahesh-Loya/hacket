import type { LeaderRow } from "./chain";

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

/** Reads the whole leaderboard page by page, stopping at the first short page. */
export async function allRows(
  fetchPage: (from: number, limit: number) => Promise<LeaderRow[]>,
  pageSize = 100,
): Promise<LeaderRow[]> {
  const rows: LeaderRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const page = await fetchPage(from, pageSize);
    rows.push(...page);
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
  return rank ? 1 - (rank - 1) / total : 0;
}
