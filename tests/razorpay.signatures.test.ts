import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { env } from "../src/config/env.js";
import { verifyRazorpayCheckoutSignature, verifyRazorpayWebhookSignature } from "../src/lib/razorpay.js";

describe("razorpay signature verification", () => {
  it("validates checkout signature", () => {
    const orderId = "order_abc";
    const paymentId = "pay_abc";
    const signature = createHmac("sha256", env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`, "utf8").digest("hex");
    expect(verifyRazorpayCheckoutSignature(orderId, paymentId, signature)).toBe(true);
    expect(verifyRazorpayCheckoutSignature(orderId, paymentId, "bad_signature")).toBe(false);
  });

  it("validates webhook signature", () => {
    const payload = Buffer.from(JSON.stringify({ id: "evt_1", event: "payment.captured" }), "utf8");
    const signature = createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET).update(payload).digest("hex");
    expect(verifyRazorpayWebhookSignature(payload, signature)).toBe(true);
    expect(verifyRazorpayWebhookSignature(payload, "bad_signature")).toBe(false);
  });
});
