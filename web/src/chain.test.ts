import { afterEach, describe, expect, it, vi } from "vitest";
import { view } from "./chain";

afterEach(() => vi.unstubAllGlobals());

describe("view", () => {
  it("gives up on an RPC that never answers", async () => {
    vi.stubGlobal("fetch", (_url: string, init: RequestInit) =>
      new Promise((_, reject) => init.signal?.addEventListener("abort", () => reject(new Error("aborted")))),
    );
    await expect(view("get_config", {}, 30)).rejects.toThrow();
  });
});
