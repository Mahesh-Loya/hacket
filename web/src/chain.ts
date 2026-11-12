import { CONTRACT_ID, RPC_URLS } from "./config";

/** Read-only contract call over JSON-RPC. No wallet needed. */
export async function view<T>(method: string, args: object = {}): Promise<T> {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: "market",
    method: "query",
    params: {
      request_type: "call_function",
      finality: "final",
      account_id: CONTRACT_ID,
      method_name: method,
      args_base64: btoa(JSON.stringify(args)),
    },
  });
  let lastError: unknown;
  for (const url of RPC_URLS) {
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
      const json = await res.json();
      if (json.error || json.result?.error) throw new Error(JSON.stringify(json.error ?? json.result.error));
      return JSON.parse(new TextDecoder().decode(new Uint8Array(json.result.result))) as T;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

export type CategoryPicks = { category: string; ids: string[] };
export type Config = {
  owner_id: string;
  lock_at_ns: string;
  agents: string[];
  has_results: boolean;
  player_count: number;
};
export type LeaderRow = { account_id: string; score: number; is_agent: boolean; updated_ns: string };
export type Entry = { picks: CategoryPicks[]; updated_ns: string };
