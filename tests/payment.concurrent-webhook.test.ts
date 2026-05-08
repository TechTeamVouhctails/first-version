import { describe, expect, it } from "vitest";
import { resolveWebhookDedupeKey } from "../src/services/paymentService.js";

describe("concurrent webhook dedupe key stability", () => {
  it("returns identical dedupe key for concurrent payload parses", async () => {
    const payload = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: { id: "pay_concurrent", order_id: "order_concurrent" }
        }
      }
    };
    const keys = await Promise.all([1, 2, 3, 4, 5].map(async () => resolveWebhookDedupeKey(payload)));
    expect(new Set(keys).size).toBe(1);
    expect(keys[0]).toBe("payment.pay_concurrent.manual-dedupe");
  });
});
