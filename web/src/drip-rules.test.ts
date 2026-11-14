import { describe, expect, it } from "vitest";
import { DRIP_AMOUNT, dripDecision } from "./drip-rules";

const NEAR = 10n ** 24n;

describe("dripDecision", () => {
  it("sends to an existing testnet account that is nearly empty", () => {
    expect(dripDecision("maheshloya.testnet", 0n)).toEqual({ ok: true });
    expect(DRIP_AMOUNT).toBe(NEAR / 10n);
  });

  it("refuses accounts that already have enough", () => {
    expect(dripDecision("rich.testnet", NEAR / 10n)).toMatchObject({ ok: false });
  });

  it("refuses accounts that don't exist", () => {
    expect(dripDecision("ghost.testnet", null)).toMatchObject({ ok: false });
  });

  it("refuses names that aren't testnet accounts, and our own accounts", () => {
    expect(dripDecision("someone.near", 0n)).toMatchObject({ ok: false });
    expect(dripDecision("Bad Name.testnet", 0n)).toMatchObject({ ok: false });
    expect(dripDecision("hype.hackket.testnet", 0n)).toMatchObject({ ok: false });
    expect(dripDecision("hackket-tap.testnet", 0n)).toMatchObject({ ok: false });
  });
});

describe("isTestnetAccount", () => {
  it("accepts testnet names and rejects anything else before asking NEAR", async () => {
    const { isTestnetAccount } = await import("./drip-rules");
    expect(isTestnetAccount("maheshloya.testnet")).toBe(true);
    expect(isTestnetAccount("")).toBe(false);
    expect(isTestnetAccount("Bad Name.testnet")).toBe(false);
  });
});
