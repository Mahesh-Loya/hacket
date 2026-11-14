import { view, type Entry } from "./chain";
import { LOCK_AT_MS } from "./config";
import { CATEGORY_ORDER } from "./consensus";
import { esc } from "./esc";
import { agentIcon } from "./icons";
import { buildPicks, pickOptions } from "./picks";
import { onChange } from "./scoreboard";
import { AGENTS, trackName, type Data } from "./projects";
import type * as WalletModule from "./wallet";

let wallet: typeof WalletModule;

const PLACES = ["1st", "2nd", "3rd"];

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
  const dis = locked ? " disabled" : "";
  const cards = CATEGORY_ORDER.map((cat) => {
    const chosen = byCat.get(cat) ?? [];
    const slots = Array.from({ length: slotsFor(cat) }, (_, i) => {
      const place = cat === "grand" ? "Winner" : PLACES[i];
      return `<label class="slot">${cat === "grand" ? "" : `<span>${place}</span>`}<select data-cat="${cat}" aria-label="${esc(trackName(cat))}, ${place}"${dis}>${options(cat, data, chosen[i] ?? "")}</select></label>`;
    }).join("");
    return `<div class="cat-card${cat === "grand" ? " grand" : ""}"><div class="t">${esc(trackName(cat))}</div>${slots}</div>`;
  }).join("");
  const copy = Object.keys(AGENTS)
    .map((name) => `<button class="btn sm" data-copy="${name}"${dis}>${agentIcon(name, 20)}<span style="text-transform:capitalize">${name}</span></button>`)
    .join("");
  el.innerHTML = `<div class="panel">
    <div class="picker-top"><span>Signed in as <b>${esc(wallet.accountId() ?? "")}</b></span><button class="btn sm" id="signout">Sign out</button></div>
    ${locked ? '<p class="notice">Picks are locked. Judging has started.</p>' : ""}
    ${current ? '<p class="msg ok" style="margin:0 0 18px">Your picks are saved on NEAR. Change anything and save again until the lock.</p>' : ""}
    <div class="copy"><div class="k">Start from an agent's picks, then change what you disagree with</div><div class="row">${copy}</div></div>
    <div class="picker-grid">${cards}</div>
    <div class="save"><button class="btn pri" id="submit"${dis}>${current ? "Update my picks" : "Lock in my picks"}</button><span id="msg" class="msg" role="status"></span></div>
    <p class="note">Saving sends one transaction with 0.05 testnet NEAR attached. The contract keeps what your picks' storage costs (about 0.02) and refunds the rest. Testnet NEAR is free play money.</p>
  </div>`;
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

function setMsg(el: HTMLElement, kind: "ok" | "err" | "wait", text: string) {
  const msg = el.querySelector<HTMLElement>("#msg")!;
  msg.className = `msg ${kind}`;
  msg.textContent = text;
}

export function mountPicker(
  el: HTMLElement,
  data: Data,
  hooks: { onSubmitted: () => void; onAccount: (account: string | null) => void },
) {
  const locked = () => Date.now() >= LOCK_AT_MS;
  const navButton = document.getElementById("nav-signin");

  async function render() {
    const account = wallet.accountId();
    hooks.onAccount(account);
    if (!account) {
      el.innerHTML = `<div class="panel signed-out">
        <p>Sign in with a NEAR <b>testnet</b> wallet to save your picks on-chain. It's free and takes a minute.
          <span class="small muted">No testnet account? Click sign in and choose <b>Meteor Wallet</b>: it makes a free one.
          New accounts start empty, so first get free testnet NEAR from the
          <a href="https://docs.near.org/getting-started/faucet" target="_blank" rel="noopener">NEAR faucet ↗</a>.</span></p>
        <button class="btn pri" id="signin"${locked() ? " disabled" : ""}>Sign in to pick</button></div>`;
      el.querySelector("#signin")?.addEventListener("click", () => wallet.signIn());
      return;
    }
    const current = await view<Entry | null>("get_picks", { account_id: account }).catch(() => null);
    renderForm(el, data, current, locked());
    el.querySelector("#signout")?.addEventListener("click", () => wallet.signOut());
    el.querySelectorAll<HTMLButtonElement>("[data-copy]").forEach((b) =>
      b.addEventListener("click", () => {
        fillFrom(el, data.agents[b.dataset.copy!].picks);
        setMsg(el, "wait", `Copied ${b.dataset.copy}'s picks. Change any you like, then save.`);
      }),
    );
    el.querySelector("#submit")?.addEventListener("click", async (e) => {
      const button = e.currentTarget as HTMLButtonElement;
      try {
        const picks = buildPicks(readSelection(el));
        button.disabled = true; // one transaction per click, even if the wallet is slow
        setMsg(el, "wait", "Waiting for your wallet…");
        await wallet.submitPicks(picks);
        hooks.onSubmitted();
        await render(); // shows the saved picks and switches the button to "Update my picks"
        setMsg(el, "ok", "Saved on NEAR testnet.");
      } catch (e) {
        button.disabled = false;
        const text = e instanceof Error ? e.message : "Something went wrong. Try again.";
        setMsg(el, "err", /balance/i.test(text) ? `${text} Get free testnet NEAR from the NEAR faucet (docs.near.org/getting-started/faucet), then try again.` : text);
      }
    });
  }

  // The nav button signs in when signed out; when signed in it is a link to this section.
  navButton?.addEventListener("click", (e) => {
    if (wallet && !wallet.accountId() && !locked()) {
      e.preventDefault();
      wallet.signIn();
    }
  });

  el.innerHTML = `<div class="panel muted">Loading wallet…</div>`;
  import("./wallet")
    .then(async (mod) => {
      wallet = mod;
      // Redraw only when the signed-in account changes, so other wallet updates never wipe unsaved choices.
      const redraw = onChange<string | null>(() => void render());
      await wallet.init(() => redraw(wallet.accountId()));
      redraw(wallet.accountId());
    })
    .catch(() => {
      el.innerHTML = `<div class="panel"><p class="msg err">Couldn't load wallet sign-in. Refresh to try again.</p></div>`;
    });
}
