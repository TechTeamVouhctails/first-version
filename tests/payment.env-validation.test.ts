import { describe, expect, it } from "vitest";

describe("payment env defaults", () => {
  it("loads payment env module", async () => {
    const mod = await import("../src/config/paymentEnv.js");
    expect(mod.paymentEnv.PLATFORM_COMMISSION_RATE).toBeGreaterThanOrEqual(0);
    expect(mod.paymentEnv.PLATFORM_COMMISSION_RATE).toBeLessThanOrEqual(1);
  });
});
