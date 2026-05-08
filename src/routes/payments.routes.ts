import { PaymentStage } from "@prisma/client";
import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { env } from "../config/env.js";
import { authMiddleware } from "../middleware/auth.js";
import { criticalActionRateLimiter } from "../middleware/rateLimit.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import {
  createOrderSchema,
  failureSimulationSchema,
  globalReconcileSchema,
  internalPayoutBatchSchema,
  manualPayoutReleaseSchema,
  manualPayoutStatusSchema,
  paymentHealthSchema,
  paymentStatusSchema,
  payoutReleaseSchema,
  reconciliationExportSchema,
  replayWebhookSchema,
  reconcileBookingSchema,
  repairBookingStateSchema,
  verifyPaymentSchema
} from "../schemas/payment.schema.js";
import { confirmPayment, createPaymentOrder, getPaymentStatus, releasePayout } from "../services/paymentService.js";
import { processDueProviderPayouts, reconcileBookingPayments, retryFailedProviderPayouts, runGlobalPaymentReconciliation } from "../services/payoutAutomationService.js";
import { getPaymentHealthSummary } from "../services/paymentHealthService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/errors.js";
import { exportReconciliation } from "../lib/payments/reconciliationExport.js";
import { simulateForcedPayoutFailure, simulateReconciliationMismatch, simulateStaleLock, simulateWebhookReplayStorm } from "../lib/payments/failureSimulation.js";
import {
  manuallyMarkPayoutReleased,
  manuallySetPayoutStatus,
  repairBookingPaymentState,
  replayWebhookByDedupeKey
} from "../lib/payments/recovery.js";

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
  "/verify",
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

paymentsRouter.get(
  "/:bookingId/status",
  validate(paymentStatusSchema),
  asyncHandler(async (req, res) => {
    const { bookingId } = req.params as { bookingId: string };
    const status = await getPaymentStatus(bookingId, req.auth!.userId);
    return res.status(StatusCodes.OK).json(status);
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

paymentsRouter.post(
  "/internal/payouts/process-due",
  validate(internalPayoutBatchSchema),
  asyncHandler(async (req, res) => {
    const token = req.headers["x-internal-payout-token"];
    if (token !== env.INTERNAL_PAYOUT_TOKEN) {
      throw new AppError("Invalid internal payout token", StatusCodes.UNAUTHORIZED, "INVALID_INTERNAL_TOKEN");
    }
    const { limit } = req.body as { limit?: number };
    const result = await processDueProviderPayouts(limit ?? 20);
    return res.status(StatusCodes.OK).json({ ok: true, result });
  })
);

paymentsRouter.get(
  "/internal/health",
  validate(paymentHealthSchema),
  asyncHandler(async (req, res) => {
    const token = req.headers["x-internal-payout-token"];
    if (token !== env.INTERNAL_PAYOUT_TOKEN) {
      throw new AppError("Invalid internal payout token", StatusCodes.UNAUTHORIZED, "INVALID_INTERNAL_TOKEN");
    }
    const result = await getPaymentHealthSummary();
    return res.status(StatusCodes.OK).json({ ok: true, result });
  })
);

paymentsRouter.post(
  "/internal/payouts/retry-failed",
  validate(internalPayoutBatchSchema),
  asyncHandler(async (req, res) => {
    const token = req.headers["x-internal-payout-token"];
    if (token !== env.INTERNAL_PAYOUT_TOKEN) {
      throw new AppError("Invalid internal payout token", StatusCodes.UNAUTHORIZED, "INVALID_INTERNAL_TOKEN");
    }
    const { limit } = req.body as { limit?: number };
    const result = await retryFailedProviderPayouts(limit ?? 20);
    return res.status(StatusCodes.OK).json({ ok: true, result });
  })
);

paymentsRouter.get(
  "/internal/reconcile/:bookingId",
  validate(reconcileBookingSchema),
  asyncHandler(async (req, res) => {
    const token = req.headers["x-internal-payout-token"];
    if (token !== env.INTERNAL_PAYOUT_TOKEN) {
      throw new AppError("Invalid internal payout token", StatusCodes.UNAUTHORIZED, "INVALID_INTERNAL_TOKEN");
    }
    const { bookingId } = req.params as { bookingId: string };
    const result = await reconcileBookingPayments(bookingId);
    return res.status(StatusCodes.OK).json({ ok: true, result });
  })
);

paymentsRouter.get(
  "/internal/reconcile",
  validate(globalReconcileSchema),
  asyncHandler(async (req, res) => {
    const token = req.headers["x-internal-payout-token"];
    if (token !== env.INTERNAL_PAYOUT_TOKEN) {
      throw new AppError("Invalid internal payout token", StatusCodes.UNAUTHORIZED, "INVALID_INTERNAL_TOKEN");
    }
    const { limit } = req.query as { limit?: number };
    const result = await runGlobalPaymentReconciliation(limit ?? 200);
    return res.status(StatusCodes.OK).json({ ok: true, result });
  })
);

paymentsRouter.get(
  "/internal/reconcile/export",
  validate(reconciliationExportSchema),
  asyncHandler(async (req, res) => {
    const token = req.headers["x-internal-payout-token"];
    if (token !== env.INTERNAL_PAYOUT_TOKEN) {
      throw new AppError("Invalid internal payout token", StatusCodes.UNAUTHORIZED, "INVALID_INTERNAL_TOKEN");
    }
    const { format, limit } = req.query as { format: "json" | "csv"; limit?: number };
    const report = await runGlobalPaymentReconciliation(limit ?? 200);
    const exported = exportReconciliation(report, format);
    res.setHeader("content-type", exported.contentType);
    return res.status(StatusCodes.OK).send(exported.payload);
  })
);

paymentsRouter.post(
  "/internal/webhook/replay",
  validate(replayWebhookSchema),
  asyncHandler(async (req, res) => {
    const token = req.headers["x-internal-payout-token"];
    if (token !== env.INTERNAL_PAYOUT_TOKEN) {
      throw new AppError("Invalid internal payout token", StatusCodes.UNAUTHORIZED, "INVALID_INTERNAL_TOKEN");
    }
    const { dedupeKey } = req.body as { dedupeKey: string };
    const result = await replayWebhookByDedupeKey(dedupeKey);
    return res.status(StatusCodes.OK).json({ ok: true, result });
  })
);

paymentsRouter.post(
  "/internal/payouts/:bookingId/mark-released",
  validate(manualPayoutReleaseSchema),
  asyncHandler(async (req, res) => {
    const token = req.headers["x-internal-payout-token"];
    if (token !== env.INTERNAL_PAYOUT_TOKEN) {
      throw new AppError("Invalid internal payout token", StatusCodes.UNAUTHORIZED, "INVALID_INTERNAL_TOKEN");
    }
    const { bookingId } = req.params as { bookingId: string };
    const { reference } = req.body as { reference?: string };
    await manuallyMarkPayoutReleased(bookingId, reference);
    return res.status(StatusCodes.OK).json({ ok: true });
  })
);

paymentsRouter.post(
  "/internal/payouts/:bookingId/set-status",
  validate(manualPayoutStatusSchema),
  asyncHandler(async (req, res) => {
    const token = req.headers["x-internal-payout-token"];
    if (token !== env.INTERNAL_PAYOUT_TOKEN) {
      throw new AppError("Invalid internal payout token", StatusCodes.UNAUTHORIZED, "INVALID_INTERNAL_TOKEN");
    }
    const { bookingId } = req.params as { bookingId: string };
    const { status } = req.body as { status: "RETRYABLE_FAILED" | "READY_AFTER_DISPUTE_WINDOW" };
    await manuallySetPayoutStatus(bookingId, status);
    return res.status(StatusCodes.OK).json({ ok: true });
  })
);

paymentsRouter.post(
  "/internal/bookings/:bookingId/repair-state",
  validate(repairBookingStateSchema),
  asyncHandler(async (req, res) => {
    const token = req.headers["x-internal-payout-token"];
    if (token !== env.INTERNAL_PAYOUT_TOKEN) {
      throw new AppError("Invalid internal payout token", StatusCodes.UNAUTHORIZED, "INVALID_INTERNAL_TOKEN");
    }
    const { bookingId } = req.params as { bookingId: string };
    await repairBookingPaymentState(bookingId);
    return res.status(StatusCodes.OK).json({ ok: true });
  })
);

paymentsRouter.post(
  "/internal/failure-simulate",
  validate(failureSimulationSchema),
  asyncHandler(async (req, res) => {
    const token = req.headers["x-internal-payout-token"];
    if (token !== env.INTERNAL_PAYOUT_TOKEN) {
      throw new AppError("Invalid internal payout token", StatusCodes.UNAUTHORIZED, "INVALID_INTERNAL_TOKEN");
    }
    if (env.NODE_ENV === "production") {
      throw new AppError("Failure simulation disabled in production", StatusCodes.FORBIDDEN, "SIMULATION_DISABLED");
    }
    const body = req.body as {
      type: "webhook_storm" | "payout_failure" | "reconciliation_mismatch" | "stale_lock";
      bookingId?: string;
      dedupeKey?: string;
      eventType?: string;
      payload?: unknown;
      attempts?: number;
      lockKey?: string;
      holdMs?: number;
    };
    if (body.type === "webhook_storm") {
      const result = await simulateWebhookReplayStorm(
        env.NODE_ENV,
        body.dedupeKey ?? "sim-webhook",
        body.eventType ?? "payment.captured",
        body.payload ?? {},
        body.attempts ?? 10
      );
      return res.status(StatusCodes.OK).json({ ok: true, result });
    }
    if (body.type === "payout_failure") {
      if (!body.bookingId) throw new AppError("bookingId required", 422, "VALIDATION_ERROR");
      const result = await simulateForcedPayoutFailure(env.NODE_ENV, body.bookingId);
      return res.status(StatusCodes.OK).json({ ok: true, result });
    }
    if (body.type === "reconciliation_mismatch") {
      const result = await simulateReconciliationMismatch(env.NODE_ENV);
      return res.status(StatusCodes.OK).json({ ok: true, result });
    }
    const result = await simulateStaleLock(env.NODE_ENV, body.lockKey ?? "default", body.holdMs ?? 3000);
    return res.status(StatusCodes.OK).json({ ok: true, result });
  })
);
