# Website redesign: "style D, professional"

Date: 2026-11-12 · Status: approved style, design under review
Approved mockup: `.superpowers/brainstorm/2675-1794489663/content/full-page-d.html` (git-ignored scratch; this document is the source of truth, the mockup shows the look).

## Why

The site works but the owner finds it "too plain and boring" and "AI generated". The site is the first thing hackathon judges and people from the X post see. Judges skim many entries fast, so the page must (1) say what the project is in about 3 seconds, (2) look finished and trustworthy, (3) hold up in a small video frame and on a phone.

## Goals

- Replace the current look with the approved **style D**: calm near-black page, an editorial serif for headlines, a sans for body, monospace for numbers, left-aligned layout, thin borders, no emoji.
- Lead with the idea **Humans vs AI**: a scoreboard and countdown at the top.
- Show the agents' thinking as **real data**: a scrolling "where they agree" strip and a consensus table.
- Fix everything broken on the way (sign-in in dev mode was one; already fixed in `web/src/polyfills.ts`, see below).

## Non-goals

- No changes to the contract, the agents, or their picks.
- No new framework (stay Vite + TypeScript, no React). No new runtime dependencies beyond Google Fonts.
- No Vercel deploy in this piece of work (the owner deploys later).

## Anti-goals (would make this a failure even if it works)

- **Any made-up number.** Everything shown comes from `data/agents.json`, `data/facts.json` or the contract. Where a number doesn't exist yet (scores before results), show "—" with a plain explanation. The mockup's "42 players", "alice.testnet" and Accord ranks were placeholders.
- Looking like a generic AI template: emoji icons, purple gradients everywhere, everything centred, badge soup.
- Breaking on a phone (375px wide): no sideways scrolling of the page.
- Motion that can't be stopped: the strip must respect "reduce motion".

## Constraints

- Fonts: Instrument Serif (headlines), Inter (body), JetBrains Mono (numbers) from Google Fonts, with system fallbacks so it still looks fine if fonts fail.
- Colours (from the mockup): background `#0a0a0b`, panel `#111113`, lines `#222226`/`#2e2e33`, text `#ededef`, muted `#8b8b93`, dim `#5c5c64`. One colour per agent, used everywhere that agent appears: screener `#5ee0ff`, mechanist `#a78bfa`, builder `#fbbf24`, hype `#f472b6`, contrarian `#a3e635`.
- Each agent gets a small inline-SVG icon (from the mockup): magnifier, dot-triangle, stacked blocks, bars, inverted triangle. Replaces the emoji in `AGENTS` everywhere (cards, find, picker, leaderboard).
- Existing behaviour and safety stays: HTML escaping (`esc`), https-only links (`safeUrl`), tie-consistent ranks (`rankMap`), unknown saved picks kept (`pickOptions`), lazy-loaded wallet code.
- All existing tests keep passing; new pure logic gets vitest tests.

## The page, top to bottom (as decided)

1. **Top bar (sticky).** Logo mark (the chart-in-rounded-square SVG) + "Hackathon Market"; links Agents · Consensus · Picks · Leaderboard · Rules (Rules opens `RULES.md` on GitHub); a `testnet` chip; a **Sign in** button. When signed in the button shows the short account name; clicking it jumps to the picks section. On phones the text links hide; logo + sign-in stay.
2. **Hero, two columns** (stacks on phones).
   - Left: eyebrow "NEAR Hackathon 2026 · free prediction game"; headline "Five AI judges made their calls. *Can you beat them?*" (second sentence in muted italic); one paragraph; buttons "Make your picks →" (to picks) and "See the agents"; three stats from real data: entries ranked (count of projects), 14 categories, 5 AI judges.
   - Right: **scoreboard card**. Header: green "Live on NEAR" dot + contract id. Body: Humans vs AI, each with best score and a count underneath ("best score · N players" / "best score · 5 agents"). Before results the scores show "—" and the line "Scores appear when winners are announced (~18 Nov)". Bottom: countdown in days / hrs / min / sec ticking every second until the lock. After the lock it reads "Picks locked · judging in progress"; after results it shows the real best scores and names the leader side.
   - Data: best human / best AI = top score among rows where `is_agent` is false / true in `get_leaderboard`; player count = number of non-agent rows. If the contract can't be reached: show "—" and "Couldn't reach NEAR right now".
3. **Agreement strip.** One line of monospace text scrolling slowly, built from real agent data, items like "DEFI #1 · KratonOS 3/5 agents agree", "Accord picked 18× by agents", "GAMES #1 · no two agents agree". Pauses on hover. With "reduce motion" it doesn't move (wraps or is scrollable instead).
4. **The judges.** Five cards: icon, name, question, a "looks at" line (screener: repo · README · demo; mechanist: game & market design; builder: contracts · Intents · mainnet; hype: votes · comments; contrarian: quality minus popularity), grand pick. The mockup's coloured bar under "looks at" is decoration only (a fixed full-width line in the agent colour), not a fake percentage. Phones: cards in a horizontally swipeable row or 2-column grid, page itself never scrolls sideways.
5. **Where they agree** (new). Table: one row per category (grand first, then the 13 tracks), one column per agent showing its #1 pick, plus a Consensus column. A cell gets a green dot when 3+ agents share that #1. Consensus = "Name n/5" when the most common #1 is shared by 2+ agents, else "split". Shows 5 rows (grand + the 4 with the strongest agreement) and a "Show all 14" button. Table scrolls inside its box on phones.
6. **Find your project.** Search box with icon; a dropdown list of up to 8 matches; the chosen project card shows name (link), tracks, "Builder says…" summary, then one row per agent: icon + name, a bar in the agent colour (width = how high it ranks: `1 − (rank−1)/total`), "#rank of total", chips for any categories where that agent picked it, and the agent's one-line reason.
7. **Make your picks.** Same logic as now, restyled to match: signed-out state explains it's free + testnet + link to make an account; signed-in state shows account + sign out, "Start from an agent's picks" buttons (icon + name), a grid of category cards (each with its 1 or 3 dropdowns labelled 1st/2nd/3rd), then the save button and the plain-words note about the 0.05 testnet NEAR deposit. Status messages ("Waiting for your wallet…", "Saved on NEAR testnet.", errors) are clearly visible, not tiny grey text.
8. **Leaderboard.** Rank, player, points. Agents show icon + name + "AI" tag; the signed-in player's own row is highlighted. Empty state "No picks yet. Be the first."
9. **Footer.** Contract link, NearHunt data credit, source link, "Free points only. Not affiliated with the NEAR Hackathon organizers."

Favicon becomes the logo mark (SVG), replacing the 🔮.

## Already fixed during this conversation

- Sign-in failed in the local dev preview ("Couldn't load wallet sign-in") because Meteor wallet code reads `process.env`, which browsers don't have. `web/src/polyfills.ts` now sets an empty `process.env`. Verified: the sign-in modal lists MyNearWallet and Meteor. Not yet committed.

## Calls made after the builder check (my calls, owner can overrule)

- **Ties for consensus.** If two or more projects share the most #1 votes, list them all ("Intents Desk · Marks, 2/5 each") and give no green dot. Never show one name as the winner of a tie.
- **Which 5 consensus rows show first.** Grand prize first. Then tracks sorted by how many agents share the top #1 (most first), ties kept in the usual track order (defi, thesis, privacy, …). The mockup's rows were just an illustration.
- **What the strip says.** Two kinds of item only: (a) one per category, "DEFI #1 · KratonOS · 3/5 agents agree" or "GAMES #1 · no two agents agree"; (b) for the 6 projects picked by the most agents, e.g. "Accord · picked by N/5 agents", followed by 5 dots where the lit ones = how many agents picked it anywhere in their top 3. Count agents, not slots. The "picked 18×" wording is dropped.
- **Scoreboard tie.** After results, if the best human and best AI score are equal, it says "Tied".
- **Counting players.** Page through `get_leaderboard` (100 at a time) until a page comes back short, so 200+ players are counted correctly. Humans = rows with `is_agent` false.

## Left to the builder

- Exact spacing, font sizes on phones, hover states, transitions (subtle).
- How the ticker is built (CSS animation on a duplicated list is fine).
- File split (e.g. a `consensus.ts` for the pure agreement logic, `icons.ts` for the SVGs).
- Whether search matches open on Enter / arrow keys (nice to have).

## Done means

- `npm test` (vitest) and `npm run build` pass; the repo's `demo.sh` still passes.
- Screenshots at 1280px and 375px wide: no console errors, no sideways page scroll, matches the mockup's look.
- Sign-in modal opens in both `npm run dev` and the built preview.
- Every number on the page traces to agents.json, facts.json or the contract.
