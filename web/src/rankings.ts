import { pickedBy } from "./consensus";
import { rankMap, type Data, type Project } from "./projects";

export type RankingRow = {
  id: string;
  /** Overall place; equal averages share a place (1, 1, 3). Null when no judge ranked it. */
  place: number | null;
  /** Average of the judges' ranks (lower is better), over the judges that ranked it. */
  avg: number | null;
  /** Each judge's own rank, undefined where it didn't rank the project. */
  ranks: Record<string, number | undefined>;
  /** How many agents put it anywhere in their picks. */
  pickedBy: number;
};

/** Every project, ordered by the average of the five judges' ranks; ties by name. */
export function projectRankings(data: Data): RankingRow[] {
  const maps = Object.entries(data.agents).map(([name, out]) => [name, rankMap(out.scores, data.byId)] as const);
  const picks = new Map(pickedBy(data.agents).map((p) => [p.id, p.agents]));
  const name = (id: string) => (data.byId.get(id)?.name ?? "").toLowerCase();

  const rows: RankingRow[] = data.projects.map((p: Project) => {
    const ranks: Record<string, number | undefined> = {};
    for (const [agent, map] of maps) ranks[agent] = map.get(p.id);
    const known = Object.values(ranks).filter((r): r is number => r !== undefined);
    const avg = known.length ? known.reduce((a, b) => a + b, 0) / known.length : null;
    return { id: p.id, place: null, avg, ranks, pickedBy: picks.get(p.id) ?? 0 };
  });

  rows.sort((a, b) => {
    if (a.avg === null || b.avg === null) return a.avg === b.avg ? 0 : a.avg === null ? 1 : -1;
    return a.avg - b.avg || (name(a.id) < name(b.id) ? -1 : name(a.id) > name(b.id) ? 1 : 0);
  });
  rows.forEach((row, i) => {
    if (row.avg === null) return;
    row.place = i > 0 && rows[i - 1].avg === row.avg ? rows[i - 1].place : i + 1;
  });
  return rows;
}

/** Rows whose project name contains the query (any case); places stay the overall ones. */
export function filterRankings(rows: RankingRow[], query: string, byId: Map<string, Project>): RankingRow[] {
  const q = query.trim().toLowerCase();
  return q ? rows.filter((r) => (byId.get(r.id)?.name ?? "").toLowerCase().includes(q)) : rows;
}
