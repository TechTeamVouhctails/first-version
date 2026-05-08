import { describe, expect, it } from "vitest";
import { splitGrossCommissionPaise } from "../src/lib/payments/commission.js";

describe("splitGrossCommissionPaise", () => {
  it("splits 17.5% pilot commission on paise", () => {
    const { platformFeePaise, providerSharePaise } = splitGrossCommissionPaise(10_000, 0.175);
    expect(platformFeePaise).toBe(1750);
    expect(providerSharePaise).toBe(8250);
  });
});
