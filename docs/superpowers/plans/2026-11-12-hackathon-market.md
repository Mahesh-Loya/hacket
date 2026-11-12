# The Hackathon Market Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A NEAR testnet prediction game where 5 AI judge-persona agents and humans pick NEAR Hackathon track winners for free points, locked at judging start and scored on one leaderboard.

**Architecture:** A Rust `near-sdk` contract stores picks, enforces the lock, holds official results and computes scores in a view. A stdlib-only Python package fetches entries from the NearHunt API, extracts facts (rule-based, optional LLM), runs 5 personas and publishes their picks via NEAR CLI. A static Vite + TypeScript site reads the contract and the agents' JSON output, and lets wallet users submit picks.

**Tech Stack:** Rust (GNU host toolchain, already installed) + near-sdk 5.x + cargo-near; near-cli-rs; Python 3.13 stdlib + pytest; Vite + TypeScript + near-api-js + @near-wallet-selector; Vercel.

**Spec:** `docs/superpowers/specs/2026-11-12-hackathon-market-design.md`

## Global Constraints

- Network: **testnet**. Owner `hackket.testnet`; contract `market.hackket.testnet`; agents `screener|mechanist|builder|hype|contrarian.hackket.testnet`. The network and contract id live in one config place per component (`web/src/config.ts`, `agents/config.py`).
- Lock: `lock_at_ns = 1794787200000000000` (2026-11-16 00:00:00 UTC), set in `new`, no setter.
- Categories (14, exact strings): `defi, thesis, privacy, business, swarms, security, agents, realworld, games, nfts, memecoins, social, open, grand`.
- Scoring: +3 exact rank, +1 elsewhere in player's top 3, `grand` correct +5.
- Project ids: NearHunt `submission_id` (lowercase UUID). Contract accepts 1–64 chars of `[a-z0-9-]`.
- NearHunt API: `https://nearhunt.xyz/api/projects?limit=100[&cursor=…]`, follow `next_cursor` until null; only rows with `account == "nearhunt.near"`; retry a 503 once; no polling loops.
- Agents never pick our own entry (id in `agents/config.py: OWN_PROJECT_IDS`, empty until we submit; match also by name "The Hackathon Market").
- Python agents use **stdlib only** (urllib, json); pytest for tests.
- No secrets in the repo: keys stay in NEAR CLI keychain; LLM keys via env vars `NEARAI_API_KEY` or `ANTHROPIC_API_KEY`.
- Code freeze 2026-11-14 23:59 UTC; target submission 12:00 UTC same day.
- README is "do X → see Y", no marketing copy; MIT LICENSE.

## Review Focus

1. **Picks submitted after lock** → contract panics with `"Picks are locked"`; site disables the form and says so. (Task 3 test `submit_after_lock_fails`; Task 9 lock check.)
2. **Player resubmits with fewer categories** → old categories disappear, storage shrinks, no panic, no refund needed. (Task 3 test `resubmit_replaces_and_shrinks`.)
3. **Results only partially entered** (some categories missing or <3 winners) → scores count only what exists; leaderboard never panics. (Task 2 test `partial_results`.)
4. **A picked id that's not in our project snapshot** (late or withdrawn entry) → site shows "Unknown project (id…)" instead of crashing. (Task 8 test in `web/src/projects.test.ts`.)
5. **NearHunt API down or returns 503** → agents retry once, then fall back to `data/projects.json` with a printed warning. (Task 5 test `fetch_falls_back_to_snapshot`.)

---

### Task 1: Repo, tools and testnet accounts

**Files:**
- Create: `.gitignore` (target/, node_modules/, dist/, .env, __pycache__/, .venv/), `LICENSE` (MIT, 2026, hackket)

- [ ] **Step 1:** `git init` in `A:/WebDev/NearHunt`, add `.gitignore`, `LICENSE`, commit the spec + plan: `git commit -m "docs: design and plan"`.
- [ ] **Step 2:** Install near-cli-rs and cargo-near with their official PowerShell installers from their GitHub releases (`near-cli-rs-installer.ps1`, `cargo-near-installer.ps1`). Verify: `near --version` and `cargo near --version` print versions.
- [ ] **Step 3:** Create the owner from the faucet: `near account create-account sponsor-by-faucet-service hackket.testnet autogenerate-new-keypair save-to-keychain network-config testnet create`. Verify: `near account view-account-summary hackket.testnet network-config testnet now` shows a non-zero balance.
- [ ] **Step 4:** Create `market.hackket.testnet` (fund 4 NEAR) and the 5 agent sub-accounts (0.5 NEAR each) with `create-account fund-myself … sign-as hackket.testnet`, keys saved to keychain. Verify each with `view-account-summary`. If the faucet balance is short, stop and tell the user.

### Task 2: Contract scoring module

**Files:**
- Create: `contract/Cargo.toml`, `contract/rust-toolchain.toml` (use what `cargo near new` generates), `contract/src/lib.rs` (stub `mod scoring;`), `contract/src/scoring.rs`

**Interfaces:**
- Produces: `pub struct CategoryPicks { pub category: String, pub ids: Vec<String> }` (`#[near(serializers=[json, borsh])]`, `Clone`, `PartialEq`, `Debug`) and `pub fn score(picks: &[CategoryPicks], results: &[CategoryPicks]) -> u32` and `pub const CATEGORIES: [&str; 14]`.

- [ ] **Step 1:** Generate the crate with `cargo near new contract` and strip the example to an empty contract.
- [ ] **Step 2: Write failing tests** in `scoring.rs`:
  - `exact_rank_scores_3`: picks swarms [a,b,c], results swarms [a,x,y] → 3.
  - `in_top3_wrong_rank_scores_1`: picks [b,a,c], results [a,x,y] → 1.
  - `grand_correct_scores_5`: grand [g] vs [g] → 5; grand [h] vs [g] → 0.
  - `sum_across_categories`: swarms [a,b,c] vs [a,b,c] (9) + games [d] vs [z,d] (1) → 10.
  - `partial_results`: results list empty → 0; results missing the player's category → 0; result with 1 winner only → scored on that one.
- [ ] **Step 3:** Run `cargo test` in `contract/` → FAIL (score not defined).
- [ ] **Step 4:** Implement `score`: for each results category, find the player's same category; for each winner at index i, +3 if `player.ids.get(i) == winner`, else +1 if contained; `grand` uses +5 for index-0 match.
- [ ] **Step 5:** `cargo test` → PASS. Commit `feat(contract): scoring`.

### Task 3: Contract state and methods

**Files:**
- Modify: `contract/src/lib.rs`
- Create: `contract/src/validate.rs`

**Interfaces:**
- Consumes: `CategoryPicks`, `score`, `CATEGORIES` (Task 2).
- Produces (JSON API used by Tasks 4, 7, 9, 10):
  - `#[init] new(owner_id: AccountId, lock_at_ns: U64)`
  - `#[payable] submit_picks(picks: Vec<CategoryPicks>)`
  - `register_agent(account_id: AccountId)` — owner only
  - `set_results(results: Vec<CategoryPicks>)` — owner only, only after lock
  - views: `get_config() -> Config { owner_id, lock_at_ns: U64, agents: Vec<AccountId>, has_results: bool, player_count: u32 }`, `get_picks(account_id) -> Option<Entry>`, `get_results() -> Option<Vec<CategoryPicks>>`, `get_leaderboard(from_index: u32, limit: u32) -> Vec<LeaderRow { account_id, score: u32, is_agent: bool, updated_ns: U64 }>`
  - `Entry { picks: Vec<CategoryPicks>, updated_ns: U64 }`
- State: `owner_id`, `lock_at_ns: u64`, `entries: IterableMap<AccountId, Entry>`, `agents: IterableSet<AccountId>`, `results: Option<Vec<CategoryPicks>>`.

- [ ] **Step 1: Write failing tests** (near-sdk `testing_env!` unit tests in `lib.rs`), panics asserted with `#[should_panic(expected = "...")]`:
  - `submit_before_lock_stores_entry` (attach 0.05 NEAR; `get_picks` returns it)
  - `submit_after_lock_fails` → "Picks are locked"
  - `rejects_unknown_category` → "Unknown category"
  - `rejects_duplicate_category` → "Duplicate category"
  - `rejects_more_than_3_or_duplicate_ids` → "1 to 3 distinct ids"
  - `grand_needs_exactly_one` → "grand takes exactly 1 id"
  - `rejects_bad_id_chars` (e.g. `"A B"`) → "Bad project id"
  - `insufficient_deposit_fails` (attach 0) → "Attach at least"
  - `resubmit_replaces_and_shrinks` (3 categories then 1 → `get_picks` has 1, no panic)
  - `set_results_owner_only` → "Owner only"; `set_results_before_lock_fails` → "Results only after lock"
  - `leaderboard_sorted_with_agents_flagged` (2 humans + 1 registered agent; scores desc, tie → earlier `updated_ns` first; agent `is_agent == true`; `from_index/limit` slices)
- [ ] **Step 2:** `cargo test` → FAIL.
- [ ] **Step 3:** Implement. `validate.rs: pub fn validate_picks(picks: &[CategoryPicks], is_results: bool)` — results allow 0–3 ids (grand 0–1), picks require 1–3 (grand exactly 1). Storage: measure `env::storage_usage()` before/after; required = growth × `env::storage_byte_cost()`; panic `"Attach at least {n} yoctoNEAR"` if short; refund the excess with `Promise::new(caller).transfer(...)` when > 0.
- [ ] **Step 4:** `cargo test` → PASS. `cargo near build non-reproducible-wasm` → produces `.wasm`. Commit `feat(contract): picks, lock, results, leaderboard`.

### Task 4: Deploy contract to testnet

**Files:**
- Create: `scripts/deploy.sh` (idempotent notes in comments; runs build + deploy with init call), `scripts/register-agents.sh`

- [ ] **Step 1:** Deploy: `cargo near deploy build-non-reproducible-wasm market.hackket.testnet with-init-call new json-args '{"owner_id":"hackket.testnet","lock_at_ns":"1794787200000000000"}' prepaid-gas '100 Tgas' attached-deposit '0 NEAR' network-config testnet sign-with-keychain send`. If the network rejects the wasm for unsupported features, pin `contract/rust-toolchain.toml` to the version cargo-near's template recommends and redeploy.
- [ ] **Step 2:** Register the 5 agents (owner calls `register_agent`).
- [ ] **Step 3:** Verify: `near contract call-function as-read-only market.hackket.testnet get_config json-args {} network-config testnet now` shows 5 agents, `has_results: false`. Commit `chore: deploy scripts`.

### Task 5: Agents — fetch and facts

**Files:**
- Create: `agents/__init__.py`, `agents/config.py`, `agents/fetch.py`, `agents/facts.py`, `tests/test_fetch.py`, `tests/test_facts.py`, `tests/fixtures/projects_page.json` (3 real rows trimmed from the API)

**Interfaces:**
- Produces:
  - `fetch.fetch_projects(snapshot_path: str = "data/projects.json", refresh: bool = False) -> list[dict]` (refresh=True hits the API, writes snapshot; otherwise reads snapshot)
  - `fetch.fetch_readme(repo_url: str | None) -> str | None` (GitHub `raw.githubusercontent.com/<owner>/<repo>/HEAD/README.md`; None on any failure)
  - `facts.extract_facts(project: dict, readme: str | None) -> dict` with keys: `id, name, tracks, has_repo, readme_ok, has_live_link, has_video, mentions_mainnet, mentions_intents, votes, comments, description_len, summary, mechanic_novelty, near_depth, polish` (last three ints 0–5; rule-based heuristics from keywords/lengths; `summary` = first sentence of description, ≤140 chars)

- [ ] **Step 1: Write failing tests:** `paginates_until_cursor_null` (monkeypatched urlopen returns 2 pages), `drops_rows_not_written_by_nearhunt`, `fetch_falls_back_to_snapshot` (urlopen raises HTTP 503 twice → returns snapshot, prints warning), `facts_from_fixture_row` (known values from fixture), `facts_handle_null_description_and_repo`.
- [ ] **Step 2:** `python -m pytest tests -q` → FAIL.
- [ ] **Step 3:** Implement. Send a `User-Agent: hackathon-market` header.
- [ ] **Step 4:** pytest → PASS. Run `python -c "from agents.fetch import fetch_projects; print(len(fetch_projects(refresh=True)))"` → prints ≥ 618 and writes `data/projects.json`. Commit `feat(agents): fetch + facts` (include snapshot).

### Task 6: Agents — personas, picks and offline run

**Files:**
- Create: `agents/personas.py`, `agents/run.py`, `tests/test_personas.py`
- Output: `data/facts.json`, `data/agents.json`

**Interfaces:**
- Consumes: Task 5 functions.
- Produces:
  - `personas.PERSONAS: dict[str, Callable[[dict], tuple[float, str]]]` keys exactly `screener, mechanist, builder, hype, contrarian`; each returns (score, one-line reason ≤140 chars, factual, no insults).
  - `personas.pick_all(facts: list[dict], persona: str, exclude_ids: set[str]) -> dict` → `{"picks": [{"category","ids"}], "reasons": {id: str}, "scores": {id: float}}`; for each of the 13 tracks the top 3 among projects tagged with it (fewer if fewer exist; skip empty); `grand` = overall #1.
  - CLI `python -m agents.run [--refresh] [--llm] [--publish]` writes `data/facts.json` (list) and `data/agents.json` (`{persona: pick_all result}`).
- Persona definitions: screener = has_repo+readme_ok+has_live_link+has_video+polish; mechanist = mechanic_novelty dominant; builder = near_depth + mainnet + intents; hype = votes*2 + comments; contrarian = (polish+near_depth+mechanic_novelty) penalised by votes.

- [ ] **Step 1: Write failing tests:** `each_persona_returns_score_and_reason`, `pick_all_only_uses_tagged_projects`, `pick_all_excludes_own_entry`, `grand_is_single_overall_top`, `personas_disagree` (on a fixture of 10 facts, at least 3 distinct `grand` picks across the 5 personas), `ids_are_distinct_and_max_3`.
- [ ] **Step 2:** pytest → FAIL. **Step 3:** implement. **Step 4:** pytest → PASS.
- [ ] **Step 5:** `python -m agents.run` (offline, no key) → prints a table persona × grand pick and writes both JSON files. Commit `feat(agents): personas + offline run`.

### Task 7: Agents — publish to contract

**Files:**
- Create: `agents/publish.py`, `tests/test_publish.py`

**Interfaces:**
- Produces: `publish.build_command(persona: str, picks: list[dict]) -> list[str]` (argv for `near contract call-function as-transaction market.hackket.testnet submit_picks json-args <json> prepaid-gas '100 Tgas' attached-deposit '0.05 NEAR' sign-as <persona>.hackket.testnet network-config testnet sign-with-keychain send`) and `publish.publish_all(agents_json: dict, dry_run: bool) -> None`.

- [ ] **Step 1: Test** `build_command_shape` (argv contains signer `screener.hackket.testnet` and valid JSON `{"picks": [...]}`), `dry_run_prints_not_runs`.
- [ ] **Step 2–4:** fail → implement (subprocess) → pass.
- [ ] **Step 5:** `python -m agents.run --publish` on testnet; verify `get_picks screener.hackket.testnet` returns data and `get_leaderboard` lists 5 agents. Commit.

### Task 8: Web — read-only site

**Files:**
- Create: `web/` via `npm create vite@latest web -- --template vanilla-ts`; `web/src/config.ts` (`NETWORK="testnet"`, `CONTRACT_ID="market.hackket.testnet"`, `LOCK_AT_MS=1794787200000`), `web/src/chain.ts`, `web/src/projects.ts`, `web/src/main.ts`, `web/src/style.css`, `web/src/projects.test.ts` (vitest); `web/scripts/copy-data.mjs` copies `../data/{projects,facts,agents}.json` to `web/public/data/` (run as `prebuild`/`predev`).

**Interfaces:**
- Produces: `chain.view<T>(method: string, args: object): Promise<T>` (near-api-js JSON-RPC, no wallet); `projects.loadData(): Promise<{projects, facts, agents}>`; `projects.label(id: string, byId: Map<string, Project>): string` → name, or `"Unknown project (" + id.slice(0,8) + "…)"`.

- [ ] **Step 1: Test** `label_unknown_id` and `label_known_id`. Fail → implement → pass (`npx vitest run`).
- [ ] **Step 2:** Build sections from spec §7.3: hero + countdown (to lock, then "awaiting results", then "final"); "Find your project" search (name substring) → card with each agent's score + reason and whether it's in that agent's picks; leaderboard table (agent rows labeled 🤖, humans by account). Tokens on `:root` with dark mode; works at 375px width.
- [ ] **Step 3:** `npm run dev`, open it, check search for "Nims" shows 5 agent opinions and leaderboard shows 5 agents. Commit.

### Task 9: Web — sign in and submit picks

**Files:**
- Create: `web/src/wallet.ts`, `web/src/picker.ts`

**Interfaces:**
- Consumes: `CONTRACT_ID`, `NETWORK`, `loadData`, `view`.
- Produces: `wallet.init()`, `wallet.signIn()`, `wallet.accountId(): string | null`, `wallet.submitPicks(picks: CategoryPicks[]): Promise<void>` (function call `submit_picks`, 100 Tgas, deposit 0.05 NEAR — excess refunded by contract).

- [ ] **Step 1:** Wallet selector with MyNearWallet + Meteor (testnet). A "Need a free testnet account?" link to the wallet's create page.
- [ ] **Step 2:** Picker: per category a dropdown of up to 3 projects tagged with that track (grand: any project, 1); "Copy <agent>'s picks" fills the form from `data/agents.json`; prefill from `get_picks` if the player already submitted; form disabled with "Picks are locked" when `Date.now() >= LOCK_AT_MS`.
- [ ] **Step 3:** Manually: sign in with a testnet account, copy Mechanist's picks, submit → leaderboard shows the account. Commit.

### Task 10: Optional LLM facts (only once a key exists)

**Files:**
- Create: `agents/llm.py`, `tests/test_llm.py`

**Interfaces:**
- Produces: `llm.enrich(facts: dict, project: dict, readme: str | None) -> dict` → returns facts with `summary, mechanic_novelty, near_depth, polish` from the model; on any error returns facts unchanged. Provider by env: `NEARAI_API_KEY` → NEAR AI Cloud OpenAI-compatible chat endpoint; else `ANTHROPIC_API_KEY` → Messages API with a small model (check current model id via the claude-api skill). Strict JSON response; values clamped 0–5; README truncated to 6000 chars; prompt states descriptions are builder claims.
- [ ] **Step 1: Test** `enrich_parses_json` and `enrich_falls_back_on_error` (monkeypatched HTTP). Fail → implement → pass.
- [ ] **Step 2:** `python -m agents.run --refresh --llm`, cache by `id+updated_at` in `data/llm_cache.json`. Commit.

### Task 11: Ship — hosting, RULES, README, self-screen, submit

**Files:**
- Create: `RULES.md` (spec §6 + own-entry exclusion + unranked-winners note), `README.md` (sections from spec §8), `Makefile`/`demo.sh` (`cargo test` + `pytest` + `python -m agents.run` offline + print leaderboard preview from local scoring)

- [ ] **Step 1:** Deploy `web/` to Vercel (user logs in with `! npx vercel login`); verify the live URL loads data and leaderboard.
- [ ] **Step 2:** Write RULES.md and README (include live URL, contract id, honesty notes: testnet, owner can redeploy, descriptions are builder claims, AI-written code disclosed).
- [ ] **Step 3: Self-screen:** fresh subagent clones the public repo into an empty dir, follows README only, reports any step that fails or any claim not backed by code. Fix all.
- [ ] **Step 4:** User records a 60–90 s video (problem → search own project → agents' opinions → copy picks → submit → leaderboard) and posts on X with "built at NEAR HACKATHON", @NEARProtocol, #NEARHackathon, links, and a question. Then submits on nearhackathon.com (tracks: swarms, games, social, open). Put our submission id into `OWN_PROJECT_IDS`.
- [ ] **Step 5 (15 Nov, ops):** `python -m agents.run --refresh [--llm] --publish` to include late entries. No code changes.
- [ ] **Step 6 (≈18 Nov, ops):** Fill `data/results.json` (`[{"category","ids"}]`, map winner names → ids via NearHunt search) and run `scripts/set-results.sh` (owner calls `set_results`; create this script in Step 2 alongside RULES.md). Verify `get_leaderboard` shows non-zero scores; post the outcome on X.
