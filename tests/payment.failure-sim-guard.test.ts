import { describe, expect, it } from "vitest";
import { simulateStaleLock } from "../src/lib/payments/failureSimulation.js";

describe("failure simulation guard", () => {
  it("blocks simulation when disabled", async () => {
    await expect(simulateStaleLock("production", "test", 100)).rejects.toThrow(/disabled/);
  });
});
