/** Free play money for new players: shared by the /api/drip function and its tests. */

export const DRIP_AMOUNT = 10n ** 23n; // 0.1 testnet NEAR: enough to save picks many times
export const DRIP_BELOW = 10n ** 23n; // only accounts with less than this get topped up

const TESTNET_ACCOUNT = /^(([a-z\d]+[-_])*[a-z\d]+\.)+testnet$/;

/** Whether to send play money to `accountId`, given its available balance (null = account doesn't exist). */
export function dripDecision(accountId: string, available: bigint | null): { ok: true } | { ok: false; reason: string } {
  if (accountId.length > 64 || !TESTNET_ACCOUNT.test(accountId)) return { ok: false, reason: "That isn't a testnet account name." };
  if (accountId === "hackket.testnet" || accountId.endsWith(".hackket.testnet") || accountId === "hackket-tap.testnet") {
    return { ok: false, reason: "That account belongs to the game itself." };
  }
  if (available === null) return { ok: false, reason: "That account doesn't exist on testnet yet." };
  if (available >= DRIP_BELOW) return { ok: false, reason: "You already have enough play money." };
  return { ok: true };
}
