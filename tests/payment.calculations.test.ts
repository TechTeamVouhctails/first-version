import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { computePaymentBreakdown, toRupeeDecimalFromPaise } from "../src/lib/payments/calculations.js";

describe("payment calculations", () => {
  it("computes gross split and converts paise to rupees", () => {
    const breakdown = computePaymentBreakdown(new Prisma.Decimal("499.50"), 0.175);
    expect(breakdown.grossAmountPaise).toBe(49950);
    expect(breakdown.platformFeePaise).toBe(8741);
    expect(breakdown.providerSharePaise).toBe(41209);
    expect(toRupeeDecimalFromPaise(8741).toString()).toBe("87.41");
  });
});
