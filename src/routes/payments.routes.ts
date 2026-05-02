import { PaymentStage } from "@prisma/client";
import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { env } from "../config/env.js";
import { authMiddleware } from "../middleware/auth.js";
import { criticalActionRateLimiter } from "../middleware/rateLimit.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { createOrderSchema, payoutReleaseSchema, verifyPaymentSchema } from "../schemas/payment.schema.js";
import { confirmPayment, createPaymentOrder, releasePayout } from "../services/paymentService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/errors.js";

export const paymentsRouter = Router();

paymentsRouter.use(authMiddleware);

paymentsRouter.post(
  "/create-order",
  requireRole("PET_PARENT"),
  criticalActionRateLimiter,
  validate(createOrderSchema),
  asyncHandler(async (req, res) => {
    const { bookingId, stage } = req.body as { bookingId: string; stage: PaymentStage };
    const idempotencyKey = req.headers["x-idempotency-key"];
    if (!idempotencyKey || typeof idempotencyKey !== "string") {
      throw new AppError("x-idempotency-key header is required", 422, "MISSING_IDEMPOTENCY_KEY");
    }
    const output = await createPaymentOrder(bookingId, stage, idempotencyKey, req.auth!.userId);
    return res.status(StatusCodes.OK).json(output);
  })
);

paymentsRouter.post(
  "/verify-payment",
  requireRole("PET_PARENT"),
  criticalActionRateLimiter,
  validate(verifyPaymentSchema),
  asyncHandler(async (req, res) => {
    const { bookingId, orderId, paymentId, signature, stage } = req.body as {
      bookingId: string;
      orderId: string;
      paymentId: string;
      signature: string;
      stage: PaymentStage;
    };
    const transaction = await confirmPayment(bookingId, orderId, paymentId, signature, stage, req.auth!.userId);
    return res.status(StatusCodes.OK).json({ transaction });
  })
);

paymentsRouter.post(
  "/payout/:bookingId/release",
  requireRole("PROVIDER"),
  validate(payoutReleaseSchema),
  asyncHandler(async (req, res) => {
    const token = req.headers["x-internal-payout-token"];
    if (token !== env.INTERNAL_PAYOUT_TOKEN) {
      throw new AppError("Invalid internal payout token", StatusCodes.UNAUTHORIZED, "INVALID_INTERNAL_TOKEN");
    }
    const { bookingId } = req.params as { bookingId: string };
    await releasePayout(bookingId, req.auth!.userId);
    return res.status(StatusCodes.OK).json({ ok: true });
  })
);
