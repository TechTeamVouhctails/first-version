import { createHmac } from "crypto";
import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { Prisma } from "@prisma/client";
import { env } from "../config/env.js";
import { processWebhook } from "../services/paymentService.js";
import { AppError } from "../utils/errors.js";

export async function handleRazorpayWebhook(req: Request, res: Response) {
  const signature = req.headers["x-razorpay-signature"];
  const bodyBuffer = req.body as Buffer;

  if (!signature || typeof signature !== "string") {
    throw new AppError("Missing webhook signature", StatusCodes.UNAUTHORIZED, "INVALID_WEBHOOK_SIGNATURE");
  }

  const digest = createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET).update(bodyBuffer).digest("hex");
  if (digest !== signature) {
    throw new AppError("Invalid webhook signature", StatusCodes.UNAUTHORIZED, "INVALID_WEBHOOK_SIGNATURE");
  }

  const event = JSON.parse(bodyBuffer.toString("utf8")) as { id: string; event: string };
  const result = await processWebhook(event.id, event.event, event as unknown as Prisma.InputJsonValue);
  return res.status(StatusCodes.OK).json({ ok: true, result });
}
