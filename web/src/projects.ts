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

export const AGENTS: Record<string, { emoji: string; question: string }> = {
  screener: { emoji: "🔍", question: "Will a judge be able to run it?" },
  mechanist: { emoji: "⚙️", question: "Are the rules clever?" },
  builder: { emoji: "🧱", question: "How deep does it go on NEAR?" },
  hype: { emoji: "📣", question: "What does the crowd love?" },
  contrarian: { emoji: "🦔", question: "Who is underrated?" },
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
