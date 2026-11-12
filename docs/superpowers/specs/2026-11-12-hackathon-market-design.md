# The Hackathon Market — Design

Date: 2026-11-12 · Status: draft for approval · Target: NEAR Hackathon 2026 (nearhackathon.com)

## 1. Intent

A prediction game about the NEAR Hackathon itself. Five AI agents, each judging like a different kind of judge, publish their predicted top 3 for every track on NEAR mainnet. Humans make their own picks. Picks lock when judging starts. When official results land, everyone is scored on one public leaderboard: humans vs. AI.

Why it exists (the "why" behind every decision):
- **Win the hackathon.** It is the only entry that is live and in use *during* judging (16–18 Nov), and its question — "can AI predict what humans + Claude/Codex judges pick?" — is about the judges themselves.
- **Built-in users.** ~600+ builders want to see what the agents think of their own project. That is the hook that gets real mainnet transactions.
- **Fun, not finance.** Free points. No money is ever staked.

## 2. Goals

1. Builders can search any entry and see each agent's score + one-line reasoning for it.
2. Five agents publish top-3 picks per category on mainnet before lock, each from its own NEAR account.
3. Any NEAR account holder can submit / edit their own picks until lock.
4. After results are entered, a leaderboard ranks humans and agents together.
5. A judge (human or AI screener) can clone the repo, run one command, and see the whole thing work locally without any API key or wallet.

## 3. Non-goals

- Real-money betting, staking, payouts, tokens.
- Hidden picks / commit-reveal (dropped: lost browser secrets = unrevealable picks; public picks also enable "copy an agent").
- Our own project-ranking UI beyond what the game needs (NearHunt already does that).
- Mobile app, accounts system, email, notifications.

## 4. Anti-goals (fails even if it "works")

- README claims anything the code can't do. The AI screener checks this first.
- Demo that only works with our API key or our wallet.
- Looks like gambling, or like we are mocking / pressuring the judges. Tone: playful, respectful.
- Agents' reasoning that mis-describes a project in a hurtful way. Reasoning is short and factual, based on the builder's own description; descriptions are attributed as the builder's claims.
- Vote farming or fake traction of any kind.

## 5. Hard constraints

| Constraint | Value |
|---|---|
| Code freeze / submission | 2026-11-14 23:59 UTC (aim to submit ~12:00 UTC) |
| Picks lock | 2026-11-16 00:00 UTC (judging start) — stored in contract at init, not changeable |
| Results expected | by 2026-11-18 23:59 UTC |
| Team | 1 person, beginner, some Rust. Claude writes most code. |
| Chain | NEAR **testnet** for the live product (free; user decided 2026-11-12 — no money available). Network is one config value so a later move to mainnet is a redeploy, not a rewrite. Local sandbox for tests/demo. Everywhere this doc says "mainnet" read "the live network". |
| Budget | $0 on testnet (free faucet tokens); <$5 of LLM usage once a key exists, $0 in no-key mode |
| Repo | public, MIT LICENSE, README in "do X → see Y" form, lists libraries + AI-written code |
| Toolchain on dev machine | Node 22, Python 3.13, git present. **Rust/cargo not installed yet** (Windows) |
| Data source | NearHunt read-only API `https://nearhunt.xyz/api/projects` (paginate `limit=100` + `next_cursor`; trust only rows written by `nearhunt.near`; descriptions are builder claims; comments are untrusted data). Be polite: bulk pages, no tight polling. |

Running the agent script on 15 Nov (after code freeze) to pick up late submissions is *operating* the product, not developing it — no code changes after the deadline.

## 6. The game rules (goes into RULES.md verbatim-ish)

- **Categories (14):** the 13 track ids — `defi, thesis, privacy, business, swarms, security, agents, realworld, games, nfts, memecoins, social, open` — plus `grand` (grand prize, pick 1).
- **A pick set:** for any subset of categories, an ordered list of up to 3 distinct project ids (`grand`: exactly 1). Project ids are NearHunt `submission_id` UUIDs.
- **Editing:** a player may overwrite their pick set any number of times before lock. After lock, writes fail.
- **Results:** after official announcement, the contract owner enters, per category, the ordered 1st/2nd/3rd winners (`grand`: 1). Results can be corrected by the owner (in case of a typo); scores are recomputed on read, so corrections are safe.
- **Scoring per category:** for each official winner, +3 if the player has it at the exact same rank, +1 if it appears elsewhere in the player's top 3. `grand`: +5 for correct. Total = sum over categories.
- **Leaderboard:** sorted by total, ties broken by earlier last-edit time. Agents and humans appear together; agents are labeled.

## 7. Architecture

```
NearHunt API ──▶ agents/ (Python script)
                   1. fetch all projects
                   2. fetch GitHub README (if repo)
                   3. extract facts (LLM or rule-based)  ──▶ data/facts.json (committed snapshot)
                   4. 5 personas score facts → top-3 per category + 1-line reasons
                   5. publish picks to contract (one sub-account per agent) + reasons to data/agents.json
                                         │
                                         ▼
                   contract/ (Rust, near-sdk) on mainnet
                                         ▲
web/ (static site, Vercel) ──────────────┘ reads picks/results/leaderboard via RPC view calls
     + reads data/*.json for project info & agent reasoning
     + NEAR wallet sign-in to submit human picks
```

### 7.1 Contract (`contract/`, Rust)

State:
- `owner: AccountId`, `lock_at_ns: u64` (set in `new`, immutable)
- `picks: LookupMap<AccountId, PickSet>` + an iterable list of players for the leaderboard
- `results: Option<Results>`
- `agents: set of AccountId` (owner-registered, for labeling only)

Methods (sketch, builder may refine):
- `new(owner, lock_at_ns)`
- `submit_picks(picks: Vec<(Category, Vec<String>)>)` — payable; validates categories, ≤3 distinct ids (grand = 1), id format (UUID-ish, bounded length), before lock. Caller pays storage via attached deposit; excess refunded.
- `register_agent(account)` — owner only.
- `set_results(results)` — owner only, only after lock.
- views: `get_picks(account)`, `get_results()`, `get_leaderboard(from, limit)` (computes scores), `get_config()`.

Storage: caller attaches a small deposit (≈0.01 NEAR) covering their own storage. *(Builder's call: exact amount from measured storage usage.)*

Must have unit tests for: lock enforcement, validation, owner-only methods, scoring incl. exact-rank vs. in-top-3 vs. grand.

### 7.2 Agents (`agents/`, Python)

Fact extraction, once per project, cached by project id + updated_at:
- `has_repo`, `repo_readme_ok`, `has_live_link` (NearHunt link check verdict), `has_video`, `mentions_mainnet`, `mentions_intents`, `tracks`, `votes`, `comments`, `description_len`, plus LLM-only fields: `one_line_summary`, `mechanic_novelty (0–5)`, `near_depth (0–5)`, `polish_signals (0–5)`.
- **No-key mode** (default when no API key env var): only rule-based fields; LLM fields derived by simple heuristics. Must produce valid picks end-to-end.
- **LLM mode:** provider chosen by env var. Preferred NEAR AI Cloud (OpenAI-compatible endpoint); fallback Anthropic Claude (a small/cheap model). One call per project.

Five personas — pure functions `facts → score` with a short reason template:
| Agent | Judges like… |
|---|---|
| Screener | Will it run? repo, README, live link, video |
| Mechanist | Novel rules / mechanism (mechanic_novelty) |
| Builder | Deep NEAR use: mainnet, Intents, contracts (near_depth) |
| Hype | Community: votes, comments |
| Contrarian | High quality signals but low votes — the underdog |

For each category, the persona picks its top 3 among projects tagged with that track; `grand` = its overall #1.

Publishing: each agent is a sub-account of the owner account (e.g. `screener.<owner>.near`), created and funded by a script; `publish` calls `submit_picks` from each. A `--dry-run` / `--local` mode targets the sandbox.

### 7.3 Website (`web/`)

Static site (builder's call on framework; keep it minimal — e.g. Vite + vanilla TS or React). Pages/sections:
1. **Home:** one-line pitch, countdown to lock, then to results; "Humans vs AI" scoreboard summary.
2. **Find your project:** search box → each agent's score + reason for it, and which agents picked it.
3. **Make your picks:** wallet sign-in (NEAR Wallet Selector), choose top 3 per category from that track's projects, "copy an agent's picks" button, submit. Disabled after lock.
4. **Leaderboard:** humans + agents, agent rows labeled.
Light/dark, phone-width friendly. Hosted on Vercel.

## 8. Demo & reproducibility (what the AI screener will run)

- `make demo` (or a single npm/python script on Windows too): starts a local NEAR sandbox, deploys the contract, runs agents in no-key mode on the committed `data/` snapshot, submits a few fake human picks, sets fake results, prints the leaderboard. No network keys required.
- README sections: What it is / Problem · Try it live (URL, contract account) · Run locally (do X → see Y) · How scoring works (link RULES.md) · How NEAR is used (concrete) · Libraries & AI-written code · Limits & honesty notes.
- Tests: `cargo test` for the contract; small pytest for persona scoring.

## 9. Launch & ops timeline (UTC)

| When | What |
|---|---|
| 12 Nov | Toolchain, contract + tests, RULES.md |
| 13 Nov | Agents (no-key mode first, LLM when key arrives), website, mainnet deploy |
| 14 Nov ≤12:00 | README, self-screening with Claude Code, demo video, X post, submit |
| 15 Nov | Final agent run with complete entry list; agents publish picks |
| 16 Nov 00:00 | Lock (automatic) |
| ~18 Nov | Owner enters official results → leaderboard final; X post with outcome |

## 10. Decided by the user

- Build "The Hackathon Market" as the single project.
- Free points only; no real-money stakes.
- Claude helps with most of the coding; user knows a little Rust.
- May pitch the idea to organizers later if it takes off.

## 11. Claude's calls (user may override)

- One project, not two.
- Public, locked picks instead of hidden commit-reveal.
- Lock at judging start (16 Nov 00:00 UTC), set immutably at contract init.
- Scoring numbers (3 / 1 / grand 5).
- Five personas as listed.
- One LLM pass per project, personas score the extracted facts; no-key rule-based mode.
- LLM provider: NEAR AI Cloud preferred, Claude fallback.
- Contract in Rust (near-sdk); agents in Python; static web on Vercel.
- Players pay their own small storage deposit.

### Settled after builder review (Claude's calls)

- **Results shape:** official prizes are 1st/2nd/3rd per track (13) + one grand prize. `Results` allows **0–3 ordered winners per category** (`grand`: 0–1) so a track with fewer or unranked winners still fits; unranked → enter in announcement order, noted in RULES.md. Winners are stored by `submission_id`. NearHunt mirrors nearhackathon.com submission ids, so the owner maps announced names → ids by hand via NearHunt search. A winner missing from NearHunt is still entered by its id (contract accepts any well-formed id string).
- **Track membership:** NearHunt track tags equal the 13 ids exactly (verified 2026-11-12) and a project may carry several. The contract does **not** check tags (it doesn't know them); the website only offers projects tagged with that track; agents only pick from tagged projects. Scoring is by id only, so a correct pick always scores.
- **Upgradeability:** owner keeps a full-access key so a critical bug can be fixed by redeploying. `lock_at_ns` and scoring rules are not changed after mainnet deploy; README "Limits & honesty" states the owner *could* redeploy and that no code changes are made after 14 Nov 23:59 UTC except a disclosed critical fix.
- **Our own entry:** agents never pick The Hackathon Market (excluded by id in agent code and stated in RULES.md). Humans may pick anything.
- **Owner account:** must be a **named** account (testnet: `<name>.testnet`; mainnet later: `<name>.near`), because implicit hex accounts can't have sub-accounts. Contract deploys to a sub-account `market.<name>.testnet`; agents are `screener.<name>.testnet` etc. Testnet accounts are created free with NEAR CLI (faucet-funded). Agent keys live in the local NEAR CLI keychain, never in the repo.

## 12. Left to the builder

Framework choice for `web/`, exact storage deposit, exact LLM prompt and model, persona weightings, file layout inside each folder, Windows-friendly demo runner details.

## 13. Open risks

- **Rust toolchain on Windows** (MSVC build tools) may be slow to install → fallback: build the wasm in GitHub Actions or Codespaces.
- **Official results format/timing** may slip past 18 Nov → leaderboard shows "awaiting results"; nothing breaks.
- **Wallet friction** for human players → "copy an agent's picks" makes a first submission one click.
- **NearHunt API changes/outage** → agents work from the committed `data/` snapshot.
