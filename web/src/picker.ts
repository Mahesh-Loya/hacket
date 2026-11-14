import { availableBalance, view, type Entry } from "./chain";
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

const LOW_BALANCE = 6n * 10n ** 22n; // 0.06 NEAR: a little more than one save needs

/** Asks our /api/drip function for 0.1 free testnet NEAR. */
async function tap(accountId: string, msg: HTMLElement) {
  const show = (kind: "ok" | "err" | "wait", text: string) => {
    msg.className = `msg ${kind}`;
    msg.textContent = text;
  };
  const name = accountId.trim().toLowerCase();
  if (!name) return show("err", "Type your testnet account name first, e.g. yourname.testnet.");
  show("wait", "Sending…");
  try {
    const res = await fetch("/api/drip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account_id: name }),
    });
    const out = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (out.ok) show("ok", `Sent 0.1 testnet NEAR to ${name}. You're ready to play.`);
    else show("err", `${out.error ?? "That didn't work."} You can also use the NEAR faucet: docs.near.org/getting-started/faucet`);
  } catch {
    show("err", "Couldn't reach the play-money tap. Use the NEAR faucet: docs.near.org/getting-started/faucet");
  }
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
      const dis = locked() ? " disabled" : "";
      el.innerHTML = `<div class="panel">
        <ol class="steps">
          <li><b>Get a free testnet wallet.</b> Click <b>Sign in to pick</b>, choose <b>Meteor Wallet</b> and create one (its name ends in <code>.testnet</code>).
            If Meteor says “not enough balance”, that's normal for a new wallet: do step 2.</li>
          <li><b>Get free play money.</b> Testnet NEAR has no real value; we send 0.1 so you can save picks.
            <form class="tap" id="tap"><input id="tap-name" placeholder="yourname.testnet" autocomplete="off" aria-label="Your testnet account"${dis} />
            <button class="btn" type="submit"${dis}>Send me play money</button></form><span id="tap-msg" class="msg" role="status"></span></li>
          <li><b>Make your picks.</b> Sign in, copy a robot's picks, change what you disagree with, and lock them in.</li>
        </ol>
        <button class="btn pri" id="signin"${dis}>Sign in to pick</button></div>`;
      el.querySelector("#signin")?.addEventListener("click", () => wallet.signIn());
      el.querySelector<HTMLFormElement>("#tap")?.addEventListener("submit", (e) => {
        e.preventDefault();
        const name = el.querySelector<HTMLInputElement>("#tap-name")!.value;
        void tap(name, el.querySelector<HTMLElement>("#tap-msg")!);
      });
      return;
    }
    const current = await view<Entry | null>("get_picks", { account_id: account }).catch(() => null);
    renderForm(el, data, current, locked());
    const balance = await availableBalance(account);
    if (balance !== null && balance < LOW_BALANCE && !locked()) {
      el.querySelector(".picker-top")?.insertAdjacentHTML(
        "afterend",
        `<div class="row low"><span>Your wallet is low on testnet NEAR, so saving may fail.</span>
          <button class="btn sm" id="tap-me">Send me free play money</button><span id="tap-msg" class="msg" role="status"></span></div>`,
      );
      el.querySelector("#tap-me")?.addEventListener("click", () => void tap(account, el.querySelector<HTMLElement>("#tap-msg")!));
    }
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
