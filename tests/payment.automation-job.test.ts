import { describe, expect, it } from "vitest";
import { computeBackoffDelay } from "../src/jobs/paymentAutomationJob.js";

describe("payment automation scheduler backoff", () => {
  it("uses linear capped backoff", () => {
    expect(computeBackoffDelay(1000, 0)).toBe(1000);
    expect(computeBackoffDelay(1000, 1)).toBe(1000);
    expect(computeBackoffDelay(1000, 3)).toBe(3000);
    expect(computeBackoffDelay(1000, 20)).toBe(10000);
  });
});
