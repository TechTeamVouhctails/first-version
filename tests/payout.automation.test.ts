import { describe, expect, it } from "vitest";
import { canAttemptAutomatedRouteTransfer, isDueForPayout, payoutStatuses } from "../src/lib/payments/payout.js";

describe("payout automation helpers", () => {
  it("checks payout due window", () => {
    const now = new Date("2026-01-01T10:00:00.000Z");
    expect(isDueForPayout(payoutStatuses.READY_AFTER_DISPUTE_WINDOW, new Date("2026-01-01T09:59:59.000Z"), now)).toBe(true);
    expect(isDueForPayout(payoutStatuses.READY_AFTER_DISPUTE_WINDOW, new Date("2026-01-01T10:00:01.000Z"), now)).toBe(false);
  });

  it("checks automated transfer readiness", () => {
    expect(canAttemptAutomatedRouteTransfer(true, "acc_12345")).toBe(true);
    expect(canAttemptAutomatedRouteTransfer(true, "")).toBe(false);
    expect(canAttemptAutomatedRouteTransfer(false, "acc_12345")).toBe(false);
  });
});
