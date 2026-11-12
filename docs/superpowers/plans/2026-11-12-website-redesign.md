# Website Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the look of `web/` as the approved "style D, professional" page, with a Humans-vs-AI scoreboard, an agreement strip and a consensus table, all from real data.

**Architecture:** Same Vite + TypeScript static site. New pure modules (`consensus.ts`, `scoreboard.ts`, `icons.ts`) hold all logic and are unit tested; `main.ts`/`picker.ts` only render. `index.html` + `style.css` are rewritten.

**Tech Stack:** Vite 8, TypeScript, vitest; Google Fonts (Instrument Serif, Inter, JetBrains Mono).

**Spec:** `docs/superpowers/specs/2026-11-12-website-redesign-design.md`

## Global Constraints

- No made-up numbers: every number comes from `agents.json`, `facts.json` or the contract; missing → "—" with a plain explanation.
- No emoji in the UI; agents use inline SVG icons. Agent colours: screener `#5ee0ff`, mechanist `#a78bfa`, builder `#fbbf24`, hype `#f472b6`, contrarian `#a3e635`.
- Palette: bg `#0a0a0b`, panel `#111113`, lines `#222226`/`#2e2e33`, text `#ededef`, muted `#8b8b93`, dim `#5c5c64`.
- Keep `esc`, `safeUrl`, `rankMap`, `pickOptions`, lazy wallet import. No new npm dependencies.
- 375px wide: no sideways page scroll. Strip respects `prefers-reduced-motion`.
- Category order everywhere: `grand` first, then `TRACKS` order (defi, thesis, privacy, business, swarms, security, agents, realworld, games, nfts, memecoins, social, open). Agent order: screener, mechanist, builder, hype, contrarian.
- Work on branch `feat/redesign` (from `feat/market`).

## Review Focus

- An agent missing a category in agents.json → its consensus cell shows "—", counts out of agents that exist. Test in Task 2.
- Two-way tie for top #1 → both names, no green dot. Test in Task 2.
- Contract unreachable → scoreboard shows "—" + "Couldn't reach NEAR right now", page still renders. Test (pure summary of `null`) in Task 3.
- More than 100 leaderboard rows → paging collects all. Test in Task 3.
- Project not ranked by an agent (our own entry excluded) → bar empty, "excluded" text. Test in Task 3 (`rankBarWidth(undefined)`).

---

### Task 1: Commit the sign-in fix, branch

- [ ] `git checkout -b feat/redesign`; commit `web/src/polyfills.ts` + spec + this plan: `fix(web): give wallet code an empty process.env so sign-in loads in dev`.
- [ ] Verify: dev server sign-in modal lists MyNearWallet and Meteor (playwright script `signin.mjs`).

### Task 2: Consensus logic — `web/src/consensus.ts`

**Interfaces — Produces:**
```ts
export const CATEGORY_ORDER: string[]; // "grand" + TRACKS keys except grand, in order
export type ConsensusRow = { category: string; top: Record<string, string | null>; leaders: string[]; count: number; agree: boolean };
// top: agent -> its #1 id (null if none). leaders: ids sharing the most #1 votes when count >= 2, else []. agree: count >= 3 && leaders.length === 1
export function consensusRows(agents: Record<string, AgentOut>): ConsensusRow[]; // in CATEGORY_ORDER
export function featuredRows(rows: ConsensusRow[], n = 5): ConsensusRow[]; // grand + top (n-1) others by count desc, stable in CATEGORY_ORDER
export function pickedBy(agents: Record<string, AgentOut>): { id: string; agents: number }[]; // distinct agents with id anywhere in any category's top 3, desc by agents, then id
export type StripItem = { kind: "category"; category: string; leaders: string[]; count: number } | { kind: "project"; id: string; agents: number };
export function stripItems(agents: Record<string, AgentOut>, projects = 6): StripItem[]; // all 14 category items then top-N project items
```
- [ ] Tests `web/src/consensus.test.ts` with a hand-built 5-agent fixture:
  - `consensusRows` defi where 3 agents' #1 is "k" → `leaders ["k"], count 3, agree true`.
  - thesis tie 2 "a" + 2 "b" + 1 "c" → `leaders ["a","b"], count 2, agree false`.
  - games all different → `leaders [], count 1, agree false`.
  - agent lacking a category → `top[agent] === null`.
  - `featuredRows` → first is grand, rest ordered by count desc with ties in CATEGORY_ORDER.
  - `pickedBy` counts an agent once even if it picked the id in 3 categories.
  - `stripItems` length = 14 + 6 (when ≥6 projects), category items first.
- [ ] Run `npm test` → FAIL (module missing); implement; → PASS; commit `feat(web): consensus logic`.

### Task 3: Scoreboard + ranks logic — `web/src/scoreboard.ts`

**Interfaces — Produces:**
```ts
export type Summary = { bestHuman: number | null; bestAi: number | null; humans: number; agents: number; leader: "humans" | "ai" | "tied" | null };
export function summarize(rows: LeaderRow[] | null, hasResults: boolean): Summary | null; // null rows -> null. best* null when !hasResults. leader null when !hasResults or a side has no rows
export async function allRows(fetchPage: (from: number, limit: number) => Promise<LeaderRow[]>, pageSize = 100): Promise<LeaderRow[]>; // stop on short page
export function countdown(msLeft: number): { d: string; h: string; m: string; s: string }; // 2-digit, clamp at 0
export function rankBarWidth(rank: number | undefined, total: number): number; // 1-(rank-1)/total, 0 when undefined
```
- [ ] Tests `web/src/scoreboard.test.ts`: summarize counts humans/agents by `is_agent`; before results best = null, leader null; equal best → "tied"; `null` → `null`; `allRows` with 250 fake rows, pageSize 100 → 250 rows and 3 calls; `countdown(90061000)` → `{d:"01",h:"01",m:"01",s:"01"}`, negative → all "00"; `rankBarWidth(1,678)===1`, `(undefined,678)===0`.
- [ ] FAIL → implement → PASS; commit `feat(web): scoreboard summary, paging, countdown`.

### Task 4: Agent identity — `web/src/icons.ts` + `projects.ts`

- [ ] `AGENTS` becomes `Record<string, { question: string; looks: string; color: string }>` (no emoji); `looks` copy from spec §4. `icons.ts` exports `agentIcon(name: string, size = 36): string` (SVG strings from the mockup) and `logoMark(size = 22): string`.
- [ ] Test in `projects.test.ts`: every AGENTS key has a colour matching `/^#[0-9a-f]{6}$/` and `agentIcon(name)` starts with `<svg`. FAIL → implement → PASS (tsc will flag every emoji use; fix in Task 5/6).
- [ ] Commit with Task 5.

### Task 5: Page shell, styles, main rendering

**Files:** rewrite `web/index.html`, `web/src/style.css`, `web/src/main.ts`.
- [ ] `index.html`: fonts link, SVG favicon (logo mark), sticky nav (`#nav-signin`), hero (`#hero-stats`, `#scoreboard`), `#strip`, sections `#agents`, `#consensus`, `#find`, `#picks`, `#leaderboard`, footer — copy text verbatim from spec §1–9.
- [ ] `style.css`: tokens from Global Constraints; layouts from mockup; ≤ 720px: hero stacks, nav links hidden, agent cards 2-col (1-col ≤ 420px), tables in `.table-scroll`; strip animation off under `prefers-reduced-motion`, paused on hover.
- [ ] `main.ts`: render scoreboard (1 s countdown tick; `allRows(view…)`, `summarize`), strip (`stripItems`, list duplicated for loop), judges, consensus table (`featuredRows` + "Show all 14"), find (bars via `rankBarWidth`, chips, reasons), leaderboard (icon + name + AI tag, own row highlighted via `accountId` callback from picker), footer.
- [ ] Verify: `npm test`, `npm run build` pass; screenshots 1280 and 375 → no console errors, scrollWidth == viewport.
- [ ] Commit `feat(web): style D redesign`.

### Task 6: Picker restyle — `web/src/picker.ts`

- [ ] Signed-out / signed-in states per spec §7; agent copy buttons with icon; category cards with labels 1st/2nd/3rd; status message in a visible `.msg` box (`.ok` / `.err`); nav button shows short account (`name` before first dot if > 20 chars) and jumps to `#picks`; expose `onAccount(cb)` so leaderboard can highlight.
- [ ] Verify: existing picks tests pass; playwright: nav sign-in click opens modal (dev and `vite preview`).
- [ ] Commit `feat(web): restyled picker and nav sign-in`.

### Task 7: Final check

- [ ] `bash demo.sh` passes; README "Try it" steps still true (update wording if the button names changed); final whole-branch review; fix Critical/Important; merge into `feat/market` and push to `origin main` only after the user agrees.
