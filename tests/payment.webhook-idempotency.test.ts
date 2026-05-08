import { describe, expect, it } from "vitest";
import { extractPaymentCapturedEntity, resolveWebhookDedupeKey } from "../src/services/paymentService.js";

describe("webhook idempotency helpers", () => {
  it("prefers webhook id for dedupe", () => {
    const body = {
      id: "evt_123",
      event: "payment.captured",
      payload: {
        payment: {
          entity: { id: "pay_123", order_id: "order_123" }
        }
      }
    };
    expect(resolveWebhookDedupeKey(body)).toBe("evt_123");
  });

  it("falls back to payment-derived key when id is missing", () => {
    const body = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: { id: "pay_456", order_id: "order_456" }
        }
      }
    };
    expect(resolveWebhookDedupeKey(body)).toBe("payment.pay_456.manual-dedupe");
    expect(extractPaymentCapturedEntity(body)).toEqual({
      razorpayEventId: "payment.pay_456.manual-dedupe",
      orderId: "order_456",
      paymentId: "pay_456"
    });
  });
});
