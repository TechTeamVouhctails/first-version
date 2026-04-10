import { describe, expect, it } from "vitest";
import { validateStateTransition } from "../src/utils/stateMachine.js";

describe("validateStateTransition", () => {
  it("allows valid transition", () => {
    expect(() => validateStateTransition("REQUESTED", "CONFIRMED")).not.toThrow();
    expect(() => validateStateTransition("PENDING_END_OTP", "PENDING_PAYMENT")).not.toThrow();
    expect(() => validateStateTransition("COMPLETED", "PAYOUT_PENDING")).not.toThrow();
  });

  it("throws on invalid transition", () => {
    expect(() => validateStateTransition("REQUESTED", "IN_PROGRESS")).toThrowError(/Invalid booking state transition/);
    expect(() => validateStateTransition("PAID_OUT", "PAYOUT_PENDING")).toThrowError(/Invalid booking state transition/);
  });
});
