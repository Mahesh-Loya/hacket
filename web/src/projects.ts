import type { CategoryPicks } from "./chain";

export type Project = { id: string; name: string; url: string; tracks: string[]; summary: string };
export type AgentOut = { picks: CategoryPicks[]; reasons: Record<string, string>; scores: Record<string, number> };
export type Data = { projects: Project[]; byId: Map<string, Project>; agents: Record<string, AgentOut> };

export const TRACKS: Record<string, string> = {
  defi: "Unstoppable DeFi",
  thesis: "Investment Thesis",
  privacy: "Privacy & Private AI",
  business: "Autonomous Business",
  swarms: "AI Swarms",
  security: "AI Security & Defense",
  agents: "Agent Economy",
  realworld: "Real-World Money",
  games: "Games With Real Economies",
  nfts: "NFTs That Do Something",
  memecoins: "Memecoins With Mechanics",
  social: "Social Money",
  open: "Open Innovation",
  grand: "Grand Prize",
};

export const AGENTS: Record<string, { question: string; looks: string; color: string }> = {
  screener: { question: "Will a judge be able to run it?", looks: "repo · README · demo", color: "#5ee0ff" },
  mechanist: { question: "Are the rules clever?", looks: "game & market design", color: "#a78bfa" },
  builder: { question: "How deep does it go on NEAR?", looks: "contracts · Intents · mainnet", color: "#fbbf24" },
  hype: { question: "What does the crowd love?", looks: "votes · comments", color: "#f472b6" },
  contrarian: { question: "Who is underrated?", looks: "quality minus popularity", color: "#a3e635" },
};

export async function loadData(): Promise<Data> {
  const [projects, agents] = await Promise.all([
    fetch("/data/facts.json").then((r) => r.json() as Promise<Project[]>),
    fetch("/data/agents.json").then((r) => r.json() as Promise<Record<string, AgentOut>>),
  ]);
  return { projects, byId: new Map(projects.map((p) => [p.id, p])), agents };
}

/** Project name, or a short placeholder for ids we don't know (late or withdrawn entries). */
export function label(id: string, byId: Map<string, Project>): string {
  return byId.get(id)?.name ?? `Unknown project (${id.slice(0, 8)}…)`;
}

/** Persona ranks (1 = best). Ties break by name, then id, exactly like agents/personas.py. */
export function rankMap(scores: Record<string, number>, byId: Map<string, Project>): Map<string, number> {
  const name = (id: string) => (byId.get(id)?.name ?? "").toLowerCase();
  const ordered = Object.keys(scores).sort(
    (a, b) => scores[b] - scores[a] || (name(a) < name(b) ? -1 : name(a) > name(b) ? 1 : a < b ? -1 : 1),
  );
  return new Map(ordered.map((id, i) => [id, i + 1]));
}

/** Only https links from untrusted data; anything else becomes "#". */
export function safeUrl(url: string): string {
  try {
    return new URL(url).protocol === "https:" ? url : "#";
  } catch {
    return "#";
  }
}
