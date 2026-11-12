import { AGENTS } from "./projects";

/** Inner shapes of each agent's icon, drawn on a 36×36 grid in the agent's colour (`C`). */
const SHAPES: Record<string, string> = {
  screener: `<circle cx="16" cy="16" r="6" stroke="C" stroke-width="1.8" fill="none"/><path d="M20.5 20.5L26 26" stroke="C" stroke-width="1.8" stroke-linecap="round"/>`,
  mechanist: `<path d="M12 13L24 13L18 24Z" stroke="C" stroke-width="1.4" fill="none"/><circle cx="12" cy="13" r="2.5" fill="C"/><circle cx="24" cy="13" r="2.5" fill="C"/><circle cx="18" cy="24" r="2.5" fill="C"/>`,
  builder: `<rect x="10" y="20" width="16" height="5" rx="1.5" fill="C"/><rect x="12" y="14" width="12" height="5" rx="1.5" fill="C" opacity=".7"/><rect x="14" y="8" width="8" height="5" rx="1.5" fill="C" opacity=".45"/>`,
  hype: `<rect x="10" y="17" width="3" height="9" rx="1.5" fill="C"/><rect x="16.5" y="11" width="3" height="15" rx="1.5" fill="C"/><rect x="23" y="14" width="3" height="12" rx="1.5" fill="C"/>`,
  contrarian: `<path d="M11 12h14l-7 13z" stroke="C" stroke-width="1.8" fill="none" stroke-linejoin="round"/>`,
};

export function agentIcon(name: string, size = 36): string {
  const color = AGENTS[name]?.color ?? "#8b8b93";
  const shape = (SHAPES[name] ?? "").replaceAll('"C"', `"${color}"`);
  return `<svg class="agent-icon" width="${size}" height="${size}" viewBox="0 0 36 36" aria-hidden="true"><rect width="36" height="36" rx="9" fill="${color}" fill-opacity=".1"/>${shape}</svg>`;
}

export function logoMark(size = 22): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="2.5" y="2.5" width="19" height="19" rx="5" stroke="currentColor" stroke-width="1.5"/><path d="M7 15l3-3 3 2 4-6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
