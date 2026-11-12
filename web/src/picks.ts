import type { CategoryPicks } from "./chain";
import { TRACKS } from "./projects";

/** Form state (category -> chosen ids, "" for an empty slot) to contract picks. */
export function buildPicks(selection: Record<string, string[]>): CategoryPicks[] {
  const picks: CategoryPicks[] = [];
  for (const [category, slots] of Object.entries(selection)) {
    const ids = slots.filter(Boolean);
    if (!ids.length) continue;
    if (new Set(ids).size !== ids.length) throw new Error(`${TRACKS[category] ?? category}: pick different projects`);
    picks.push({ category, ids });
  }
  if (!picks.length) throw new Error("Pick at least one project");
  return picks;
}
