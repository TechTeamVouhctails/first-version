import { createHmac } from "crypto";
import { env } from "../config/env.js";

export function verifyRazorpayCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean {
  const digest = createHmac("sha256", env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`, "utf8").digest("hex");
  return digest === signature;
}

export function verifyRazorpayWebhookSignature(rawBody: Buffer, signature: string): boolean {
  const digest = createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest("hex");
  return digest === signature;
}
