import type { CategoryPicks } from "./chain";
import { TRACKS, label, type Project } from "./projects";

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

/** Dropdown choices for one slot. A saved id we can't list is kept as "Unknown project". */
export function pickOptions(category: string, projects: Project[], chosen: string): { value: string; text: string }[] {
  const pool = projects
    .filter((p) => category === "grand" || p.tracks.includes(category))
    .sort((a, b) => a.name.localeCompare(b.name));
  const opts = pool.map((p) => ({ value: p.id, text: p.name }));
  if (chosen && !pool.some((p) => p.id === chosen)) {
    opts.unshift({ value: chosen, text: label(chosen, new Map(projects.map((p) => [p.id, p]))) });
  }
  return [{ value: "", text: "—" }, ...opts];
}
