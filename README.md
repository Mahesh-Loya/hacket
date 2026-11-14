# The Hackathon Market

**Can AI predict who wins the NEAR Hackathon?** Five judge agents (rule-based personas) read all ~1,200 entries and put their predicted top 3 for every track on NEAR. Builders make their own picks for free. Picks lock when judging starts (16 Nov 2026 00:00 UTC). When the winners are announced, one leaderboard shows whether humans or AI called it.

- **Live site:** <https://hackathon-market-xi.vercel.app>
- **Contract:** [`market.hackket.testnet`](https://testnet.nearblocks.io/address/market.hackket.testnet) on NEAR testnet
- **Rules and scoring:** [RULES.md](RULES.md)

## The problem

Around 1,200 projects entered the NEAR Hackathon, and judging is partly done by AI (Claude Code and Codex screen the repos first). Builders want to know two things: how their project looks to a judge, and who is likely to win. Nobody answers either question in public, with predictions that can't be edited afterwards.

The Hackathon Market answers both. Every agent explains how it sees each project in one line. Every prediction is stored on NEAR before the lock, so nobody can change a guess once results come out.

## For judges: the five criteria

| Criterion | Where to look |
|---|---|
| **Technical implementation** | A Rust contract with 22 unit tests: the lock is enforced by block time, players fund their own storage with a refund, results are owner-only and only after the lock, and scoring runs in a view call. Five agents each sign from their own NEAR account. 23 Python tests, 51 website tests, and `./demo.sh` runs everything in one command. |
| **Design** | One page that a first-time player can follow: a Humans vs AI scoreboard, every entry ranked with a search, a 3-step how-to-play box, free play money, and one-click agent picks to start from. It works on phones. |
| **Impact** | Every builder in the hackathon can see how five judges with different lenses rate their project, and why, before the real judging. Share links let them post their rank. The game gives the whole hackathon a public, tamper-proof prediction record. |
| **Originality** | As far as we could find among ~1,200 entries, no other project predicts this hackathon's own winners or ranks the other entries. It's a game about the hackathon, played by humans and agents on one leaderboard. |
| **Sustainability** | It's reusable for any hackathon. The tracks live in `contract/src/scoring.rs`, `agents/config.py` and `web/src/projects.ts`, the lock time is a deploy argument (`scripts/deploy.sh`), the agents read any NearHunt-style API, and moving to mainnet is a redeploy. |

## Try it (live, ~2 minutes)

1. Open the live site. **See:** the Humans vs AI scoreboard with a countdown to the lock, a strip of where the agents agree, five judge cards and a table of each agent's #1 pick per track.
2. Under **Where does your project stand?**, scroll the list of every entry (ordered by the average of the 5 judges' ranks), or type a project name (e.g. `Nims`) and click it. **See:** a bar per agent showing where it ranks the project out of ~1,200, whether it picked it, and why. **Share this rank on X** posts it, and the link opens the site on that project.
3. Under **Make your picks**, follow the 3 steps on the page. **(a)** Click **Sign in to pick**, choose **Meteor Wallet** and create a free testnet account (its name ends in `.testnet`). A brand-new account has 0 NEAR, so Meteor may say "not enough balance": that's expected. **(b)** Type the account name into **Send me play money**: the site sends 0.1 free testnet NEAR (the [NEAR faucet](https://docs.near.org/getting-started/faucet) also works). **(c)** Click **Sign in to pick** again and approve. **See:** "Signed in as …" and a form with 14 categories. (MyNearWallet no longer creates new accounts; existing testnet accounts can still sign in with it.)
4. Under **Start from an agent's picks**, click an agent (e.g. **Builder**) to copy its picks, change any you disagree with, and click **Lock in my picks**. Approve in the wallet. **See:** "Saved on NEAR testnet." and your account on the leaderboard.
5. After the official results (by 18 Nov), **see:** points on the leaderboard (3 for the exact place, 1 for elsewhere in your top 3, 5 for the grand prize).

## Run it locally (no wallet, no keys)

Needs Rust (`rustup`), Python 3.10+ with `pytest` (`python3 -m pip install pytest`) and Node 22.12+. The script uses `python3` if present, else `python` (override with `PYTHON=...`).

```bash
./demo.sh
```

**See:** contract tests pass, agent tests pass, the 5 agents score the committed snapshot of 1,255 entries and print each one's grand prize pick, the website tests pass and it builds, and the live leaderboard is printed from testnet.

You can also run each part on its own:

| Do | See |
|---|---|
| `cd contract && cargo test` | 22 tests: lock, validation, storage deposit, owner-only actions, scoring, leaderboard order |
| `python -m pytest tests` | 23 tests: NearHunt paging, snapshot fallback, facts, personas, publishing, optional LLM |
| `cd web && npm ci && npm test` | 51 tests: consensus and rankings logic, scoreboard, paging, picks validation, share links, play-money rules |
| `python -m agents.run` | `data/facts.json` + `data/agents.json` rebuilt offline, plus a table of grand prize picks |
| `python -m agents.run --refresh` | re-fetches all entries from the NearHunt API and every public GitHub README |
| `python -m agents.leaderboard` | the live leaderboard read from the contract |
| `cd web && npm ci && npm run dev` | the site on <http://localhost:5173> reading the live testnet contract |

Windows note: `contract/.cargo/config.toml` sets `AWS_LC_SYS_PREBUILT_NASM=1` so the test dependencies build without NASM.

## How it works

```
NearHunt API ──▶ agents/ (Python, stdlib only)
                  fetch.py     all entries + GitHub READMEs (falls back to data/ snapshot)
                  facts.py     plain facts: repo? README? live link? video? mainnet? Intents? mechanism words?
                  llm.py       optional: a model refines facts (NEAR AI Cloud or Claude)
                  personas.py  5 judges score the facts their own way → top 3 per track + grand
                  publish.py   each agent signs submit_picks from its own account
                        │
                        ▼
contract/ (Rust, near-sdk 5.30)  market.hackket.testnet
   submit_picks · register_agent · set_results · get_leaderboard ...
                        ▲
web/ (Vite + TypeScript)  reads the contract over RPC, signs picks with NEAR Wallet Selector
api/drip.ts (Vercel)       sends 0.1 free testnet NEAR to new, empty player accounts
```

| Agent | Asks | Scores on |
|---|---|---|
| 🔍 screener | Will a judge be able to run it? | repo, README, live link, demo video |
| ⚙️ mechanist | Are the rules clever? | mechanism signals in description + README |
| 🧱 builder | How deep does it go on NEAR? | contracts, Intents, chain signatures, mainnet, NEP standards |
| 📣 hype | What does the crowd love? | NearHunt votes and comments |
| 🦔 contrarian | Who is underrated? | quality signals minus popularity |

## How NEAR is used

- **One contract holds the game.** It stores picks per account and enforces the lock time with `block_timestamp` (the time was set once at deploy, and there is no setter). It accepts results only from the owner and only after the lock, and computes everyone's score in a view call.
- **Each agent is its own NEAR account** (sub-accounts of `hackket.testnet`) and signs its own transaction, so every prediction can be traced on-chain to the agent that made it.
- **Players pay for their own storage** with an attached deposit, and the contract refunds the unused part in the same call.
- **Testnet**, so playing costs nothing. The network and contract id live in one config value per component (`agents/config.py`, `web/src/config.ts`), so moving to mainnet is a redeploy.

## Repo map

| Path | What |
|---|---|
| `contract/` | Rust smart contract and its unit tests |
| `agents/` | Python agents (fetch, facts, personas, publish, optional LLM, leaderboard) |
| `tests/` | Python tests |
| `web/` | Static website (Vite + TypeScript) |
| `data/` | Committed snapshot: `projects.json` (NearHunt), `facts.json`, `agents.json` |
| `api/` | One Vercel function: `drip.ts` sends 0.1 free testnet NEAR to new players from `hackket-tap.testnet` |
| `scripts/` | `deploy.sh`, `register-agents.sh`, `set-results.sh` |
| `docs/superpowers/` | Design spec and implementation plan |

## Libraries, data and AI-written code

- Contract: `near-sdk` 5.30 (built with `cargo-near` 0.23).
- Agents: Python standard library only; `pytest` for tests.
- Play-money tap: `near-api-js` 6.5 (Vercel function).
- Web: Vite, TypeScript, `@near-wallet-selector/*` 10.1.4 (core, modal-ui, my-near-wallet, meteor-wallet), `buffer`, `vitest`.
- Data: [NearHunt](https://nearhunt.xyz) public read-only API (project records written by `nearhunt.near`) and public GitHub READMEs.
- **AI-written code:** most of this repository was written with Claude Code (Anthropic), directed and reviewed by the author. Commits say so in their `Co-Authored-By` line.
- All code was written during the hackathon window (from 2026-11-12). The author has no other entry in this hackathon.

## Limits and honesty notes

- Runs on **testnet**: the points have no money value, and players need a free testnet account.
- The agents judge public signals and builders' own descriptions. They don't run other projects' code, so their opinions are guesses, not verdicts.
- Rule-based scoring is the default. `--llm` mode needs an API key and wasn't used for the published picks unless stated in a later commit.
- Official results are entered by hand by the owner after the announcement (`scripts/set-results.sh`).
- The owner can redeploy the contract code (see [RULES.md](RULES.md#honesty-notes)).
- This is a fan game, not affiliated with the NEAR Hackathon organizers or judges.

## License

MIT, see [LICENSE](LICENSE).
