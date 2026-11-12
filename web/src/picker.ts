import { view, type Entry } from "./chain";
import { LOCK_AT_MS } from "./config";
import { esc } from "./esc";
import { buildPicks, pickOptions } from "./picks";
import { AGENTS, TRACKS, type Data } from "./projects";
import type * as WalletModule from "./wallet";

let wallet: typeof WalletModule;

function slotsFor(category: string) {
  return category === "grand" ? 1 : 3;
}

function options(category: string, data: Data, chosen: string) {
  return pickOptions(category, data.projects, chosen)
    .map((o) => `<option value="${esc(o.value)}"${o.value === chosen ? " selected" : ""}>${esc(o.text)}</option>`)
    .join("");
}

function renderForm(el: HTMLElement, data: Data, current: Entry | null, locked: boolean) {
  const byCat = new Map((current?.picks ?? []).map((p) => [p.category, p.ids]));
  const fields = Object.keys(TRACKS)
    .map((cat) => {
      const chosen = byCat.get(cat) ?? [];
      const selects = Array.from({ length: slotsFor(cat) }, (_, i) =>
        `<select data-cat="${cat}" aria-label="${esc(TRACKS[cat])} place ${i + 1}"${locked ? " disabled" : ""}>${options(cat, data, chosen[i] ?? "")}</select>`,
      ).join("");
      return `<div><label>${esc(TRACKS[cat])}</label>${selects}</div>`;
    })
    .join("");
  const copy = Object.entries(AGENTS)
    .map(([name, m]) => `<button class="btn" data-copy="${name}"${locked ? " disabled" : ""}>${m.emoji} ${name}</button>`)
    .join("");
  el.innerHTML = `
    <div class="row"><span>Signed in as <b>${esc(wallet.accountId() ?? "")}</b></span><button class="btn" id="signout">Sign out</button></div>
    ${locked ? '<p class="notice">Picks are locked. Judging has started.</p>' : ""}
    <p class="hint">Quick start: copy an agent's picks, then change what you disagree with. Fill as many tracks as you like.</p>
    <div class="row">${copy}</div>
    <div class="picker-grid">${fields}</div>
    <div class="row"><button class="btn primary" id="submit"${locked ? " disabled" : ""}>${current ? "Update my picks" : "Lock in my picks"}</button><span id="msg" class="small"></span></div>
    <p class="small muted">Saving sends one transaction with 0.05 testnet NEAR attached. The contract keeps what your picks' storage costs (about 0.02) and refunds the rest. Testnet NEAR is free play money.</p>`;
}

function readSelection(el: HTMLElement): Record<string, string[]> {
  const sel: Record<string, string[]> = {};
  el.querySelectorAll<HTMLSelectElement>("select[data-cat]").forEach((s) => {
    (sel[s.dataset.cat!] ??= []).push(s.value);
  });
  return sel;
}

function fillFrom(el: HTMLElement, picks: { category: string; ids: string[] }[]) {
  const byCat = new Map(picks.map((p) => [p.category, p.ids]));
  const seen: Record<string, number> = {};
  el.querySelectorAll<HTMLSelectElement>("select[data-cat]").forEach((s) => {
    const cat = s.dataset.cat!;
    const i = (seen[cat] = (seen[cat] ?? -1) + 1);
    s.value = byCat.get(cat)?.[i] ?? "";
  });
}

export function mountPicker(el: HTMLElement, data: Data, onSubmitted: () => void) {
  const locked = () => Date.now() >= LOCK_AT_MS;

  async function render() {
    const account = wallet.accountId();
    if (!account) {
      el.innerHTML = `
        <p>Sign in with a NEAR <b>testnet</b> wallet to save your picks on-chain. It's free.</p>
        <div class="row"><button class="btn primary" id="signin"${locked() ? " disabled" : ""}>Sign in to pick</button>
        <a class="small" href="https://testnet.mynearwallet.com/create" target="_blank" rel="noopener">No testnet account? Make one free in a minute</a></div>`;
      el.querySelector("#signin")?.addEventListener("click", () => wallet.signIn());
      return;
    }
    const current = await view<Entry | null>("get_picks", { account_id: account }).catch(() => null);
    renderForm(el, data, current, locked());
    el.querySelector("#signout")?.addEventListener("click", () => wallet.signOut());
    el.querySelectorAll<HTMLButtonElement>("[data-copy]").forEach((b) =>
      b.addEventListener("click", () => fillFrom(el, data.agents[b.dataset.copy!].picks)),
    );
    el.querySelector("#submit")?.addEventListener("click", async () => {
      const msg = el.querySelector("#msg")!;
      try {
        const picks = buildPicks(readSelection(el));
        msg.textContent = "Waiting for your wallet…";
        await wallet.submitPicks(picks);
        msg.textContent = "Saved on NEAR testnet.";
        onSubmitted();
      } catch (e) {
        msg.textContent = e instanceof Error ? e.message : "Something went wrong. Try again.";
      }
    });
  }

  el.textContent = "Loading wallet…";
  import("./wallet")
    .then(async (mod) => {
      wallet = mod;
      await wallet.init(() => void render());
      await render();
    })
    .catch(() => {
      el.textContent = "Couldn't load wallet sign-in. Refresh to try again.";
    });
}
