import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { logger } from "../config/logger.js";
import { appendPaymentAuditLog } from "../lib/payments/audit.js";
import { verifyRazorpayWebhookSignature } from "../lib/razorpay.js";
import { processWebhook, resolveWebhookDedupeKey } from "../services/paymentService.js";
import { AppError } from "../utils/errors.js";

type RazorpayWebhookBody = {
  id?: unknown;
  event?: unknown;
};

export async function handleRazorpayWebhook(req: Request, res: Response) {
  const signature = req.headers["x-razorpay-signature"];
  const bodyBuffer = req.body as Buffer;

  if (!signature || typeof signature !== "string") {
    throw new AppError("Missing webhook signature", StatusCodes.UNAUTHORIZED, "INVALID_WEBHOOK_SIGNATURE");
  }

  if (!verifyRazorpayWebhookSignature(bodyBuffer, signature)) {
    throw new AppError("Invalid webhook signature", StatusCodes.UNAUTHORIZED, "INVALID_WEBHOOK_SIGNATURE");
  }

  let parsed: RazorpayWebhookBody;
  try {
    parsed = JSON.parse(bodyBuffer.toString("utf8")) as RazorpayWebhookBody;
  } catch {
    return res.status(StatusCodes.BAD_REQUEST).json({ ok: false, error: "invalid_json" });
  }

  const eventType = typeof parsed.event === "string" ? parsed.event : "";
  if (!eventType) {
    return res.status(StatusCodes.OK).json({ ok: true, result: { ignored: true as const, reason: "missing_event" as const } });
  }

  const dedupeKey = resolveWebhookDedupeKey(parsed);
  if (!dedupeKey) {
    return res.status(StatusCodes.OK).json({ ok: true, result: { ignored: true as const, reason: "missing_event_id" as const } });
  }

  try {
    const result = await processWebhook(dedupeKey, eventType, parsed);
    logger.info({ webhookEventId: dedupeKey, eventType, result }, "Webhook lifecycle processed");
    return res.status(StatusCodes.OK).json({ ok: true, result });
  } catch (error) {
    await appendPaymentAuditLog({
      severity: "CRITICAL",
      eventType: "WEBHOOK_ROUTE_FAILURE",
      message: "Webhook route handler failed",
      webhookEventId: dedupeKey,
      metadata: { error: error instanceof Error ? error.message : "unknown_error", eventType }
    });
    throw error;
  }
}
