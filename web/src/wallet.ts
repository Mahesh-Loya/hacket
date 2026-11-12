import "./polyfills";
import "@near-wallet-selector/modal-ui/styles.css";
import { actionCreators, setupWalletSelector, type WalletSelector } from "@near-wallet-selector/core";
import { setupModal, type WalletSelectorModal } from "@near-wallet-selector/modal-ui";
import { setupMyNearWallet } from "@near-wallet-selector/my-near-wallet";
import { setupMeteorWallet } from "@near-wallet-selector/meteor-wallet";
import type { CategoryPicks } from "./chain";
import { CONTRACT_ID, NETWORK } from "./config";

const GAS = "100000000000000"; // 100 Tgas
const DEPOSIT = "50000000000000000000000"; // 0.05 NEAR; the contract refunds what storage doesn't use

let selector: WalletSelector;
let modal: WalletSelectorModal;

export async function init(onChange: () => void) {
  selector = await setupWalletSelector({ network: NETWORK, modules: [setupMyNearWallet(), setupMeteorWallet()] });
  modal = setupModal(selector, { contractId: CONTRACT_ID, theme: "dark" });
  selector.store.observable.subscribe(onChange);
}

export function signIn() {
  modal.show();
}

export async function signOut() {
  const wallet = await selector.wallet();
  await wallet.signOut();
}

export function accountId(): string | null {
  return selector?.store.getState().accounts.find((a) => a.active)?.accountId ?? null;
}

export async function submitPicks(picks: CategoryPicks[]) {
  const wallet = await selector.wallet();
  await wallet.signAndSendTransaction({
    receiverId: CONTRACT_ID,
    actions: [actionCreators.functionCall("submit_picks", { picks }, BigInt(GAS), BigInt(DEPOSIT))],
  });
}
