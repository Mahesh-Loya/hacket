import { TRACKS, type AgentOut } from "./projects";

/** Grand prize first, then the 13 tracks in their usual order. */
export const CATEGORY_ORDER: string[] = ["grand", ...Object.keys(TRACKS).filter((c) => c !== "grand")];

export type ConsensusRow = {
  category: string;
  /** Each agent's #1 pick, or null when it picked nothing in this category. */
  top: Record<string, string | null>;
  /** Projects sharing the most #1 votes, when at least 2 agents agree; otherwise empty. */
  leaders: string[];
  /** How many agents chose each leader (1 when nobody agrees, 0 when nobody picked). */
  count: number;
  /** 3+ agents chose the same single project. */
  agree: boolean;
};

export function consensusRows(agents: Record<string, AgentOut>): ConsensusRow[] {
  return CATEGORY_ORDER.map((category) => {
    const top: Record<string, string | null> = {};
    const votes = new Map<string, number>();
    for (const [name, out] of Object.entries(agents)) {
      const id = out.picks.find((p) => p.category === category)?.ids[0] ?? null;
      top[name] = id;
      if (id) votes.set(id, (votes.get(id) ?? 0) + 1);
    }
    const count = Math.max(0, ...votes.values());
    const leaders = count >= 2 ? [...votes].filter(([, n]) => n === count).map(([id]) => id).sort() : [];
    return { category, top, leaders, count, agree: count >= 3 && leaders.length === 1 };
  });
}

/** Grand prize, then the rows where agents agree most (ties keep track order). */
export function featuredRows(rows: ConsensusRow[], n = 5): ConsensusRow[] {
  const [grand, ...rest] = rows;
  return [grand, ...[...rest].sort((a, b) => b.count - a.count).slice(0, n - 1)];
}

/** How many different agents put each project anywhere in their picks, most first. */
export function pickedBy(agents: Record<string, AgentOut>): { id: string; agents: number }[] {
  const by = new Map<string, number>();
  for (const out of Object.values(agents)) {
    for (const id of new Set(out.picks.flatMap((p) => p.ids))) by.set(id, (by.get(id) ?? 0) + 1);
  }
  return [...by]
    .map(([id, n]) => ({ id, agents: n }))
    .sort((a, b) => b.agents - a.agents || (a.id < b.id ? -1 : 1));
}

export type StripItem =
  | { kind: "category"; category: string; leaders: string[]; count: number }
  | { kind: "project"; id: string; agents: number };

export function stripItems(agents: Record<string, AgentOut>, projects = 6): StripItem[] {
  const cats: StripItem[] = consensusRows(agents).map((r) => ({
    kind: "category",
    category: r.category,
    leaders: r.leaders,
    count: r.count,
  }));
  const top: StripItem[] = pickedBy(agents)
    .slice(0, projects)
    .map((p) => ({ kind: "project", ...p }));
  return [...cats, ...top];
}
