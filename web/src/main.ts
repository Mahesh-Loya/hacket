import "./style.css";
import { view, type Config, type LeaderRow } from "./chain";
import { CONTRACT_ID, EXPLORER, LOCK_AT_MS, REPO_URL } from "./config";
import { consensusRows, featuredRows, stripItems, type ConsensusRow } from "./consensus";
import { esc } from "./esc";
import { agentIcon, logoMark } from "./icons";
import { mountPicker } from "./picker";
import { AGENTS, TRACKS, label, loadData, safeUrl, trackName, type Data } from "./projects";
import { filterRankings, projectRankings, type RankingRow } from "./rankings";
import { countdown, places, rankBarWidth, readBoard, summarize, type Summary } from "./scoreboard";

const $ = (id: string) => document.getElementById(id)!;

let me: string | null = null;
let config: Config | null = null;
let rows: LeaderRow[] | null = null;
let loaded = false;

function agentOf(accountId: string): string | null {
  const name = accountId.split(".")[0];
  return Object.hasOwn(AGENTS, name) && accountId === `${name}.hackket.testnet` ? name : null;
}

function who(name: string) {
  return `<span class="who">${agentIcon(name, 22)}${esc(name)}</span>`;
}

function shortCat(category: string) {
  return category === "grand" ? "GRAND" : category.toUpperCase();
}

/* ---------- hero ---------- */

function renderStats(data: Data) {
  $("hero-stats").innerHTML = [
    [data.projects.length, "entries ranked"],
    [Object.keys(TRACKS).length, "categories"],
    [Object.keys(AGENTS).length, "AI judges"],
  ]
    .map(([n, t]) => `<div><b>${n}</b>${t}</div>`)
    .join("");
}

function side(lbl: string, num: number | null, sub: string, leads: boolean) {
  return `<div class="side${leads ? " lead-side" : ""}"><div class="lbl">${lbl}</div><div class="num">${num ?? "—"}</div><div class="sub">${sub}</div></div>`;
}

function renderScoreboard() {
  const s: Summary | null = summarize(rows, config?.has_results ?? false);
  const reachable = rows !== null;
  const left = LOCK_AT_MS - Date.now();
  const c = countdown(left);
  const players = (n: number) => `${n} ${n === 1 ? "player" : "players"}`;
  let note: string;
  if (!loaded) note = "Reading the contract…";
  else if (!reachable) note = "Couldn't reach NEAR right now. Retrying…";
  else if (!config?.has_results) note = "Scores appear when winners are announced (~18 Nov)";
  else if (s?.leader === "tied") note = "Tied. Humans and AI share the top score.";
  else if (s?.leader) note = `${s.leader === "humans" ? "Humans" : "AI"} lead. Final results are in.`;
  else note = "Final results are in.";

  const bottom =
    left > 0
      ? `<div class="count mono" role="timer" aria-label="Time until picks lock">
          <div><b data-t="d">${c.d}</b><span>days</span></div><div><b data-t="h">${c.h}</b><span>hrs</span></div>
          <div><b data-t="m">${c.m}</b><span>min</span></div><div><b data-t="s" aria-hidden="true">${c.s}</b><span>sec</span></div></div>`
      : `<div class="board-state">${config?.has_results ? "Final leaderboard below" : "Picks locked · judging in progress"}</div>`;

  $("scoreboard").innerHTML = `
    <div class="board-h"><span class="live${reachable || !loaded ? "" : " down"}">${reachable || !loaded ? "Live on NEAR" : "Offline"}</span>
      <a class="mono" href="${EXPLORER}" target="_blank" rel="noopener">${CONTRACT_ID}</a></div>
    <div class="vs">
      ${side("Humans", s?.bestHuman ?? null, `best score · ${s ? players(s.humans) : "—"}`, s?.leader === "humans")}
      <div class="vsx">vs</div>
      ${side("AI", s?.bestAi ?? null, `best score · ${s ? `${s.agents} agents` : "—"}`, s?.leader === "ai")}
    </div>
    <p class="board-note">${note}</p>
    ${bottom}`;
}

/** Every second: update only the countdown digits, so focus and screen readers aren't disturbed. */
function tick() {
  const left = LOCK_AT_MS - Date.now();
  const digits = document.querySelectorAll<HTMLElement>("#scoreboard [data-t]");
  if (left <= 0 || !digits.length) {
    if (digits.length) renderScoreboard(); // the lock just passed: switch to the locked view
    return;
  }
  const c = countdown(left);
  digits.forEach((el) => (el.textContent = c[el.dataset.t as keyof typeof c]));
}

/* ---------- agreement strip ---------- */

function renderStrip(data: Data) {
  const total = Object.keys(data.agents).length;
  const items = stripItems(data.agents).map((it) => {
    if (it.kind === "category") {
      const what = it.leaders.length
        ? `<b>${it.leaders.map((id) => esc(label(id, data.byId))).join(" · ")}</b> · ${it.count}/${total} agents agree${it.leaders.length > 1 ? " on each" : ""}`
        : "no two agents agree";
      return `<span class="strip-item">${shortCat(it.category)} #1 · ${what}</span>`;
    }
    const dots = `<span class="on">${"●".repeat(it.agents)}</span><span class="off">${"●".repeat(Math.max(0, total - it.agents))}</span>`;
    return `<span class="strip-item"><b>${esc(label(it.id, data.byId))}</b> · picked by ${it.agents}/${total} agents<span class="dots" aria-hidden="true">${dots}</span></span>`;
  });
  // The list is drawn twice so the scroll can loop without a gap; the copy is hidden from screen readers.
  $("strip").innerHTML = `<div class="strip-track"><div>${items.join("")}</div><div aria-hidden="true">${items.join("")}</div></div>`;
}

/* ---------- judges ---------- */

function renderAgents(data: Data) {
  $("agents").innerHTML = Object.entries(AGENTS)
    .map(([name, meta]) => {
      const grand = data.agents[name]?.picks.find((p) => p.category === "grand")?.ids[0];
      return `<article class="agent">
        ${agentIcon(name)}
        <div><div class="nm">${esc(name)}</div><div class="q">${esc(meta.question)}</div></div>
        <div><div class="looks">${esc(meta.looks)}</div><div class="rule" style="background:${meta.color}"></div></div>
        <div><div class="k">Grand pick</div><div class="pick">${grand ? `<a href="#find-sec" data-show="${esc(grand)}">${esc(label(grand, data.byId))}</a>` : "—"}</div></div>
      </article>`;
    })
    .join("");
}

/* ---------- consensus ---------- */

function renderConsensus(data: Data, showAll = false) {
  const all = consensusRows(data.agents);
  const shown: ConsensusRow[] = showAll ? all : featuredRows(all);
  const names = Object.keys(AGENTS);
  const cell = (r: ConsensusRow, name: string) => {
    const id = r.top[name];
    if (!id) return `<td class="dim">—</td>`;
    const agrees = r.agree && r.leaders[0] === id;
    return `<td${agrees ? ' class="agree"' : ""}>${esc(label(id, data.byId))}</td>`;
  };
  const cons = (r: ConsensusRow) =>
    r.leaders.length
      ? `${r.leaders.map((id) => esc(label(id, data.byId))).join(" · ")} <span class="dim">${r.count}/${Object.keys(data.agents).length}${r.leaders.length > 1 ? " each" : ""}</span>`
      : `<span class="dim">split</span>`;
  $("consensus").innerHTML = `<div class="table-scroll consensus"><table>
      <thead><tr><th>Category</th>${names.map((n) => `<th>${who(n)}</th>`).join("")}<th>Consensus</th></tr></thead>
      <tbody>${shown
        .map((r) => `<tr><td class="cat">${esc(trackName(r.category))}</td>${names.map((n) => cell(r, n)).join("")}<td class="cons">${cons(r)}</td></tr>`)
        .join("")}</tbody></table></div>
    <button class="btn sm more" id="more">${showAll ? "Show fewer" : `Show all ${all.length}`}</button>`;
  $("more").addEventListener("click", () => renderConsensus(data, !showAll));
}

/* ---------- project rankings ---------- */

const PAGE = 20;

function detailHtml(row: RankingRow, data: Data) {
  const p = data.byId.get(row.id)!;
  const total = data.projects.length;
  const bars = Object.entries(AGENTS)
    .map(([name, meta]) => {
      const out = data.agents[name];
      const rank = row.ranks[name];
      const picked = (out?.picks ?? [])
        .filter((c) => c.ids.includes(row.id))
        .map((c) => `<span class="chip">Picked ${esc(trackName(c.category))} #${c.ids.indexOf(row.id) + 1}</span>`)
        .join("");
      const width = Math.round(rankBarWidth(rank, total) * 100);
      return `<div class="rrow">
        ${who(name)}
        <div class="bar"><i style="width:${width}%;background:${meta.color}"></i></div>
        <div class="rank">${rank ? `#${rank} <span>of ${total}</span>` : `<span>not ranked</span>`}</div>
        <div class="why">${picked}${esc(out?.reasons[row.id] ?? "")}</div>
      </div>`;
    })
    .join("");
  return `<div class="result">
    <div class="result-h"><a href="${esc(safeUrl(p.url))}" target="_blank" rel="noopener">Open on NearHunt ↗</a>
      <span class="chip">${p.tracks.map((t) => esc(trackName(t))).join(" · ")}</span></div>
    ${p.summary ? `<p class="says">Builder says: “${esc(p.summary)}”</p>` : ""}
    ${bars}
  </div>`;
}

function mountRankings(data: Data) {
  const all = projectRankings(data);
  const names = Object.keys(AGENTS);
  const input = $("search") as HTMLInputElement;
  const el = $("rankings");
  let limit = PAGE;
  let open: string | null = null;

  function render() {
    const found = filterRankings(all, input.value, data.byId);
    if (found.length === 1) open = found[0].id;
    const shown = found.slice(0, limit);
    if (!found.length) {
      el.innerHTML = `<p class="empty">No project matches “${esc(input.value.trim())}”.</p>`;
      return;
    }
    const body = shown
      .map((r) => {
        const p = data.byId.get(r.id)!;
        const isOpen = r.id === open;
        const cells = names
          .map((n) => `<td class="jr" style="color:${AGENTS[n].color}">${r.ranks[n] ? `#${r.ranks[n]}` : "—"}</td>`)
          .join("");
        const dots = `<span class="on">${"●".repeat(r.pickedBy)}</span><span class="off">${"●".repeat(Math.max(0, names.length - r.pickedBy))}</span>`;
        return `<tr class="prow${isOpen ? " open" : ""}" data-id="${esc(r.id)}">
            <td class="mono place">${r.place ?? "—"}</td>
            <td><button class="pname" aria-expanded="${isOpen}">${esc(p.name)}</button><div class="ptracks">${p.tracks.map((t) => esc(trackName(t))).join(" · ")}</div></td>
            ${cells}
            <td class="pb"><span class="dots" aria-label="${r.pickedBy} of ${names.length} agents">${dots}</span></td>
          </tr>${isOpen ? `<tr class="detail-row"><td colspan="${names.length + 3}">${detailHtml(r, data)}</td></tr>` : ""}`;
      })
      .join("");
    const more =
      found.length > limit
        ? `<button class="btn sm more" id="rank-more">Show ${Math.min(PAGE, found.length - limit)} more <span class="dim">· ${shown.length} of ${found.length}</span></button>`
        : `<p class="small dim more">${found.length === all.length ? `All ${all.length} projects shown.` : `${found.length} of ${all.length} projects match.`}</p>`;
    el.innerHTML = `<div class="table-scroll rankings"><table>
        <thead><tr><th>#</th><th>Project</th>${names.map((n) => `<th title="${esc(n)}'s rank">${agentIcon(n, 22)}</th>`).join("")}<th>Picked by</th></tr></thead>
        <tbody>${body}</tbody></table></div>${more}`;
  }

  input.addEventListener("input", () => {
    limit = PAGE;
    open = null;
    render();
  });
  el.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (target.closest("#rank-more")) {
      limit += PAGE;
      return render();
    }
    if (target.closest(".detail-row, a")) return;
    const id = target.closest<HTMLElement>("tr.prow")?.dataset.id;
    if (!id) return;
    open = open === id ? null : id;
    render();
  });
  // Grand picks on the agent cards jump to that project here.
  document.addEventListener("click", (e) => {
    const id = (e.target as HTMLElement).closest<HTMLElement>("[data-show]")?.dataset.show;
    if (!id) return;
    input.value = data.byId.get(id)?.name ?? "";
    limit = PAGE;
    open = id;
    render();
  });
  render();
}

/* ---------- leaderboard ---------- */

let reading = false;

async function loadRows() {
  if (reading) return; // a slow RPC must not stack up overlapping reads
  reading = true;
  const board = await readBoard(view).finally(() => (reading = false));
  rows = board.rows;
  config = board.config ?? config;
  loaded = true;
  renderBoard();
  renderScoreboard();
}

function renderBoard() {
  const el = $("board");
  if (!loaded) {
    el.innerHTML = `<p class="empty">Loading the leaderboard…</p>`;
    return;
  }
  if (rows === null) {
    el.innerHTML = `<p class="empty">Couldn't reach NEAR testnet right now. Try again in a minute.</p>`;
    return;
  }
  if (!rows.length) {
    el.innerHTML = `<p class="empty">No picks yet. Be the first.</p>`;
    return;
  }
  const scored = config?.has_results ?? false;
  const place = places(rows, scored);
  el.innerHTML = `<div class="table-scroll"><table>
    <thead><tr><th style="width:56px">#</th><th>Player</th><th style="text-align:right">Points</th></tr></thead>
    <tbody>${rows
      .map((r, i) => {
        const agent = agentOf(r.account_id);
        const name = agent ? `${who(agent)}<span class="ai-tag">AI</span>` : esc(r.account_id);
        const mine = r.account_id === me;
        return `<tr${mine ? ' class="me"' : ""}><td class="mono">${place[i] ?? "—"}</td><td>${name}${mine ? ' <span class="chip">you</span>' : ""}</td><td class="pts">${scored ? r.score : "—"}</td></tr>`;
      })
      .join("")}</tbody></table></div>`;
}

/* ---------- footer ---------- */

function renderChrome() {
  $("brand").innerHTML = `${logoMark()}<span>The Hackathon Market</span>`;
  ($("rules-link") as HTMLAnchorElement).href = `${REPO_URL}/blob/main/RULES.md`;
  $("footer").innerHTML = `<p>
    Contract <a href="${EXPLORER}" target="_blank" rel="noopener">${CONTRACT_ID}</a> on NEAR testnet ·
    Project data from <a href="https://nearhunt.xyz" target="_blank" rel="noopener">NearHunt</a> (descriptions are each builder's own words) ·
    <a href="${REPO_URL}" target="_blank" rel="noopener">Source on GitHub</a> ·
    <a href="${REPO_URL}/blob/main/RULES.md" target="_blank" rel="noopener">Rules</a></p>
    <p>Free points only. Not affiliated with the NEAR Hackathon organizers.</p>`;
}

function setAccount(account: string | null) {
  me = account;
  const btn = $("nav-signin");
  btn.innerHTML = `<span>${esc(account ?? "Sign in")}</span>`;
  btn.title = account ?? "";
  renderBoard();
}

async function start() {
  renderChrome();
  renderScoreboard();
  setInterval(tick, 1000);
  // The contract is read separately so a slow RPC never holds back the agent data.
  void loadRows();
  setInterval(loadRows, 60_000);
  let data: Data;
  try {
    data = await loadData();
  } catch {
    for (const id of ["agents", "consensus", "picker"]) {
      $(id).innerHTML = `<p class="empty">Couldn't load the agents' data. Refresh to try again.</p>`;
    }
    return;
  }
  renderStats(data);
  renderStrip(data);
  renderAgents(data);
  renderConsensus(data);
  mountRankings(data);
  mountPicker($("picker"), data, { onSubmitted: loadRows, onAccount: setAccount });
}

start();
