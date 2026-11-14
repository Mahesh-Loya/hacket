// Sends 0.1 testnet NEAR (free play money) to a new player's nearly empty testnet account,
// so they can save picks without visiting a faucet. Paid from hackket-tap.testnet.
import { Account, KeyPairSigner, providers } from "near-api-js";
import { DRIP_AMOUNT, dripDecision } from "../web/src/drip-rules";

const RPC = "https://rpc.testnet.near.org";
const TAP = "hackket-tap.testnet";
const WAIT_MS = 10 * 60_000;
const lastByIp = new Map<string, number>(); // best effort: per server instance

async function availableBalance(accountId: string): Promise<bigint | null> {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "drip",
      method: "query",
      params: { request_type: "view_account", finality: "final", account_id: accountId },
    }),
  });
  const json = await res.json();
  if (json.result) return BigInt(json.result.amount);
  if (JSON.stringify(json.error ?? "").includes("UNKNOWN_ACCOUNT")) return null;
  throw new Error("NEAR testnet didn't answer");
}

export async function POST(request: Request): Promise<Response> {
  const fail = (status: number, error: string) => Response.json({ ok: false, error }, { status });
  const ip = (request.headers.get("x-forwarded-for") ?? "?").split(",")[0].trim();
  const last = lastByIp.get(ip) ?? 0;
  if (Date.now() - last < WAIT_MS) return fail(429, "You just got play money. Try again in a few minutes.");

  const body = (await request.json().catch(() => ({}))) as { account_id?: unknown };
  const accountId = typeof body.account_id === "string" ? body.account_id.trim().toLowerCase() : "";

  let available: bigint | null;
  try {
    available = await availableBalance(accountId);
  } catch {
    return fail(503, "Couldn't reach NEAR testnet. Try again in a minute.");
  }
  const decision = dripDecision(accountId, available);
  if (!decision.ok) return fail(400, decision.reason);

  const key = process.env.TAP_PRIVATE_KEY;
  if (!key) return fail(500, "The play-money tap isn't set up.");
  try {
    const provider = new providers.JsonRpcProvider({ url: RPC });
    const tap = new Account(TAP, provider, KeyPairSigner.fromSecretKey(key as `ed25519:${string}`));
    await tap.transfer({ receiverId: accountId, amount: DRIP_AMOUNT });
  } catch {
    return fail(502, "The tap couldn't send right now. Use the NEAR faucet instead.");
  }
  lastByIp.set(ip, Date.now());
  return Response.json({ ok: true, sent: "0.1" });
}
