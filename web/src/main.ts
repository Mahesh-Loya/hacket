import "./style.css";
import { view, type Config, type LeaderRow } from "./chain";
import { CONTRACT_ID, EXPLORER, LOCK_AT_MS, REPO_URL } from "./config";
import { AGENTS, TRACKS, label, loadData, type Data } from "./projects";
import { mountPicker } from "./picker";

const $ = (id: string) => document.getElementById(id)!;

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function agentOf(accountId: string): string | null {
  const name = accountId.split(".")[0];
  return name in AGENTS && accountId.endsWith(".hackket.testnet") ? name : null;
}

function renderStatus(config: Config | null) {
  const el = $("status");
  const left = LOCK_AT_MS - Date.now();
  if (left > 0) {
    const d = Math.floor(left / 86_400_000);
    const h = Math.floor((left % 86_400_000) / 3_600_000);
    const m = Math.floor((left % 3_600_000) / 60_000);
    el.textContent = `Picks lock in ${d}d ${h}h ${m}m (16 Nov 00:00 UTC, when judging starts)`;
  } else if (!config?.has_results) {
    el.textContent = "Picks are locked. Waiting for the official results.";
  } else {
    el.textContent = "Official results are in. Final leaderboard below.";
  }
}

function renderAgents(data: Data) {
  $("agents").innerHTML = Object.entries(AGENTS)
    .map(([name, meta]) => {
      const out = data.agents[name];
      const grand = out?.picks.find((p) => p.category === "grand")?.ids[0];
      return `<article class="card agent">
        <div class="agent-head"><span class="emoji" aria-hidden="true">${meta.emoji}</span><strong>${name}</strong></div>
        <p class="muted">${esc(meta.question)}</p>
        <p class="small">Grand prize pick: <b>${grand ? esc(label(grand, data.byId)) : "—"}</b></p>
      </article>`;
    })
    .join("");
}

function ranksFor(data: Data): Record<string, Map<string, number>> {
  const ranks: Record<string, Map<string, number>> = {};
  for (const [name, out] of Object.entries(data.agents)) {
    const ordered = Object.entries(out.scores).sort((a, b) => b[1] - a[1]);
    ranks[name] = new Map(ordered.map(([id], i) => [id, i + 1]));
  }
  return ranks;
}

function renderDetail(id: string, data: Data, ranks: Record<string, Map<string, number>>) {
  const p = data.byId.get(id);
  if (!p) return;
  const total = data.projects.length;
  const rows = Object.entries(AGENTS)
    .map(([name, meta]) => {
      const out = data.agents[name];
      const picked = out.picks
        .filter((c) => c.ids.includes(id))
        .map((c) => `<span class="chip">${esc(TRACKS[c.category] ?? c.category)} #${c.ids.indexOf(id) + 1}</span>`)
        .join(" ");
      const rank = ranks[name].get(id);
      return `<tr>
        <td><span aria-hidden="true">${meta.emoji}</span> ${name}</td>
        <td>${rank ? `#${rank} of ${total}` : "excluded"}</td>
        <td>${picked || '<span class="muted">not picked</span>'}<div class="small muted">${esc(out.reasons[id] ?? "")}</div></td>
      </tr>`;
    })
    .join("");
  $("detail").innerHTML = `<article class="card">
    <h3><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.name)}</a></h3>
    <p class="muted small">${p.tracks.map((t) => esc(TRACKS[t] ?? t)).join(" · ")}</p>
    ${p.summary ? `<p class="small">Builder says: “${esc(p.summary)}”</p>` : ""}
    <div class="table-scroll"><table><thead><tr><th>Agent</th><th>Ranks it</th><th>Picked?</th></tr></thead><tbody>${rows}</tbody></table></div>
  </article>`;
}

function mountSearch(data: Data) {
  const ranks = ranksFor(data);
  const input = $("search") as HTMLInputElement;
  const list = $("matches");
  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    const hits = q ? data.projects.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8) : [];
    list.innerHTML = hits.map((p) => `<li><button data-id="${esc(p.id)}">${esc(p.name)}</button></li>`).join("");
  });
  list.addEventListener("click", (e) => {
    const id = (e.target as HTMLElement).closest("button")?.dataset.id;
    if (!id) return;
    list.innerHTML = "";
    renderDetail(id, data, ranks);
  });
}

async function renderBoard() {
  const el = $("board");
  try {
    const rows = await view<LeaderRow[]>("get_leaderboard", { from_index: 0, limit: 200 });
    if (!rows.length) {
      el.innerHTML = `<p class="muted">No picks yet. Be the first.</p>`;
      return;
    }
    el.innerHTML = `<div class="table-scroll"><table><thead><tr><th>#</th><th>Player</th><th>Points</th></tr></thead><tbody>${rows
      .map((r, i) => {
        const agent = agentOf(r.account_id);
        const who = agent
          ? `<span aria-hidden="true">${AGENTS[agent].emoji}</span> ${agent} <span class="chip">AI</span>`
          : esc(r.account_id);
        return `<tr><td>${i + 1}</td><td>${who}</td><td>${r.score}</td></tr>`;
      })
      .join("")}</tbody></table></div>`;
  } catch {
    el.innerHTML = `<p class="muted">Couldn't reach NEAR testnet right now. Try again in a minute.</p>`;
  }
}

function renderFooter() {
  $("footer").innerHTML = `<p class="small muted">
    Contract <a href="${EXPLORER}" target="_blank" rel="noopener">${CONTRACT_ID}</a> on NEAR testnet ·
    Project data from <a href="https://nearhunt.xyz" target="_blank" rel="noopener">NearHunt</a> (descriptions are each builder's own words) ·
    <a href="${REPO_URL}" target="_blank" rel="noopener">Source</a> ·
    Free points only, no money involved. Not affiliated with the NEAR Hackathon organizers.
  </p>`;
}

async function start() {
  renderFooter();
  const [data, config] = await Promise.all([loadData(), view<Config>("get_config").catch(() => null)]);
  renderStatus(config);
  setInterval(() => renderStatus(config), 30_000);
  renderAgents(data);
  mountSearch(data);
  mountPicker($("picker"), data, renderBoard);
  await renderBoard();
}

start();
