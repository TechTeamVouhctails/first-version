import { BookingState, PaymentStage, PaymentStatus, Prisma, type PaymentTransaction } from "@prisma/client";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../config/prisma.js";
import { razorpay } from "../config/razorpay.js";
import { env } from "../config/env.js";
import { paymentEnv } from "../config/paymentEnv.js";
import { appendPaymentAuditLog } from "../lib/payments/audit.js";
import { computePaymentBreakdown, toRupeeDecimalFromPaise } from "../lib/payments/calculations.js";
import { verifyRazorpayCheckoutSignature } from "../lib/razorpay.js";
import { AppError } from "../utils/errors.js";
import { transitionBookingState } from "./bookingService.js";

const ORDER_RECEIPT_PREFIX = "vouch-booking";

/** Razorpay `payment.captured` webhook envelope (minimal fields used). */
type RazorpayPaymentCapturedEnvelope = {
  id?: unknown;
  event?: unknown;
  payload?: {
    payment?: {
      entity?: {
        id?: unknown;
        order_id?: unknown;
      };
    };
  };
};

export function extractPaymentCapturedEntity(
  raw: unknown
): { razorpayEventId: string; orderId: string; paymentId: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const envelope = raw as RazorpayPaymentCapturedEnvelope;
  const topId = envelope.id;
  const entity = envelope.payload?.payment?.entity;
  const orderRaw = entity?.order_id;
  const paymentRaw = entity?.id;
  const orderId = typeof orderRaw === "string" ? orderRaw : null;
  const paymentId = typeof paymentRaw === "string" ? paymentRaw : null;
  if (!orderId || !paymentId) return null;
  const razorpayEventId =
    typeof topId === "string" && topId.length > 0 ? topId : `payment.${paymentId}.manual-dedupe`;
  return { razorpayEventId, orderId, paymentId };
}

/** Razorpay event idempotency key: prefer top-level webhook `id`, else stable synthetic key from payload. */
export function resolveWebhookDedupeKey(parsedBody: unknown): string | null {
  if (!parsedBody || typeof parsedBody !== "object") return null;
  const id = (parsedBody as { id?: unknown }).id;
  if (typeof id === "string" && id.length > 0) return id;
  const extracted = extractPaymentCapturedEntity(parsedBody);
  return extracted?.razorpayEventId ?? null;
}

export async function createPaymentOrder(bookingId: string, stage: PaymentStage, idempotencyKey: string, actorId: string) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const existing = await tx.paymentTransaction.findUnique({
      where: { idempotencyKey }
    });

    if (existing?.orderId) {
      return {
        transaction: existing,
        order: {
          id: existing.orderId,
          amount: Number(existing.amount) * 100,
          currency: existing.currency
        }
      };
    }

    const booked = await tx.paymentTransaction.findFirst({
      where: {
        bookingId,
        stage,
        status: PaymentStatus.CAPTURED
      }
    });
    if (booked) {
      throw new AppError(`${stage} payment already settled`, StatusCodes.CONFLICT, "STAGE_ALREADY_PAID");
    }

    const booking = await tx.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: {
        provider: {
          select: {
            providerProfile: { select: { routeLinkedAccountId: true } }
          }
        }
      }
    });

    if (booking.ownerId !== actorId) {
      throw new AppError("Only booking owner can pay", StatusCodes.FORBIDDEN, "FORBIDDEN");
    }

    const depositEligibleStates: Set<BookingState> = new Set([
      BookingState.REQUESTED,
      BookingState.CONFIRMED,
      BookingState.OTP_READY
    ]);
    if (stage === PaymentStage.DEPOSIT && !depositEligibleStates.has(booking.state)) {
      throw new AppError("Deposit payment is not allowed in this booking state", 409, "INVALID_PAYMENT_STAGE");
    }
    if (stage === PaymentStage.FINAL && booking.state !== BookingState.PENDING_PAYMENT) {
      throw new AppError("Final payment can only be made at pending payment", 409, "INVALID_PAYMENT_STAGE");
    }
    if (stage === PaymentStage.FINAL && !booking.depositPaidAt) {
      throw new AppError("Deposit must be paid before final payment", 409, "DEPOSIT_REQUIRED");
    }

    const currency = "INR";
    const amountDecimal = stage === PaymentStage.DEPOSIT ? booking.depositAmount : booking.finalAmount;
    const commissionRate = env.PLATFORM_COMMISSION_RATE;
    const { grossAmountPaise, platformFeePaise, providerSharePaise } = computePaymentBreakdown(amountDecimal, commissionRate);

    const routeAccountId = booking.provider.providerProfile?.routeLinkedAccountId?.trim();
    const useRouteSplit =
      env.RAZORPAY_ROUTE_SPLITS_ENABLED && !!routeAccountId && routeAccountId.length > 3 && providerSharePaise > 0;

    const orderReceipt = `${ORDER_RECEIPT_PREFIX}-${booking.id}-${stage}-${Date.now()}`;

    const transfers = useRouteSplit
      ? [
          {
            account: routeAccountId,
            amount: providerSharePaise,
            currency,
            notes: {
              bookingId,
              stage,
              grossAmountPaise: String(grossAmountPaise)
            }
          }
        ]
      : undefined;

    const orderNotes: Record<string, string> = {
      bookingId,
      stage,
      grossAmountPaise: String(grossAmountPaise),
      platformFeePaise: String(platformFeePaise),
      providerSharePaise: String(providerSharePaise),
      commissionRate: String(commissionRate),
      routeSplitsEnabled: String(useRouteSplit)
    };

    type OrderShape = {
      amount: number;
      currency: string;
      receipt: string;
      notes: Record<string, string>;
      transfers?: NonNullable<typeof transfers>;
    };
    const orderPayload: OrderShape = {
      amount: grossAmountPaise,
      currency,
      receipt: orderReceipt,
      notes: orderNotes,
      ...(transfers ? { transfers } : {})
    };

    const order = await razorpay.orders.create(orderPayload as Parameters<(typeof razorpay)["orders"]["create"]>[0]);

    const transaction = await tx.paymentTransaction.create({
      data: {
        bookingId,
        stage,
        amount: amountDecimal,
        status: PaymentStatus.CREATED,
        currency,
        orderId: order.id,
        idempotencyKey,
        metadata: {
          actorId,
          commissionRate,
          grossAmountPaise,
          platformFeePaise,
          providerSharePaise,
          routeSplitAttempted: useRouteSplit
        }
      }
    });

    return { transaction, order };
  });
}

export function verifyRazorpaySignature(orderId: string, paymentId: string, signature: string): boolean {
  return verifyRazorpayCheckoutSignature(orderId, paymentId, signature);
}

type ApplyOpts = {
  signature?: string | null;
  webhookEventId?: string | null;
  requireSignature: boolean;
};

async function applyCapturedPaymentInTx(
  tx: Prisma.TransactionClient,
  orderId: string,
  paymentId: string,
  opts: ApplyOpts
): Promise<
  | { status: "no_order" }
  | { status: "idempotent_repeat"; transaction: PaymentTransaction }
  | { status: "captured_new"; transaction: PaymentTransaction }
> {
  const row = await tx.paymentTransaction.findUnique({
    where: { orderId }
  });

  if (!row) return { status: "no_order" as const };

  const booking = await tx.booking.findUniqueOrThrow({
    where: { id: row.bookingId }
  });

  if (opts.requireSignature && (!opts.signature || !verifyRazorpaySignature(orderId, paymentId, opts.signature))) {
    throw new AppError("Invalid payment signature", StatusCodes.BAD_REQUEST, "INVALID_SIGNATURE");
  }

  if (row.status === PaymentStatus.CAPTURED) {
    if (row.paymentId === paymentId) {
      await tx.paymentTransaction.update({
        where: { id: row.id },
        data: {
          ...(opts.signature && !row.signature ? { signature: opts.signature } : {}),
          ...(opts.webhookEventId && row.webhookEventId == null ? { webhookEventId: opts.webhookEventId } : {}),
          ...(opts.webhookEventId && row.paymentId === paymentId
            ? {
                metadata:
                  row.metadata && typeof row.metadata === "object" && row.metadata !== null
                    ? { ...(row.metadata as object), webhookConfirmedAt: new Date().toISOString() }
                    : { webhookConfirmedAt: new Date().toISOString() }
              }
            : {})
        }
      });
      const updated = await tx.paymentTransaction.findUniqueOrThrow({
        where: { id: row.id }
      });
      return { status: "idempotent_repeat" as const, transaction: updated };
    }

    throw new AppError(
      "This order was settled with another payment reference",
      StatusCodes.CONFLICT,
      "PAYMENT_ID_MISMATCH"
    );
  }

  const updatedTx = await tx.paymentTransaction.update({
    where: { id: row.id },
    data: {
      paymentId,
      ...(opts.signature ? { signature: opts.signature } : {}),
      ...(opts.webhookEventId ? { webhookEventId: opts.webhookEventId } : {}),
      status: PaymentStatus.CAPTURED,
      metadata:
        row.metadata && typeof row.metadata === "object" && row.metadata !== null
          ? { ...(row.metadata as object), capturedAt: new Date().toISOString() }
          : { capturedAt: new Date().toISOString() }
    }
  });

  if (row.stage === PaymentStage.DEPOSIT) {
    await tx.booking.update({
      where: { id: row.bookingId },
      data: { depositPaidAt: new Date() }
    });
  }

  if (row.stage === PaymentStage.FINAL) {
    await tx.booking.update({
      where: { id: row.bookingId },
      data: { finalPaidAt: new Date() }
    });

    await transitionBookingState(tx, row.bookingId, booking.ownerId, BookingState.PAYMENT_LOCKED, "Final payment captured");
    await tx.booking.update({
      where: { id: row.bookingId },
      data: { paymentLockedAt: new Date() }
    });
    await transitionBookingState(tx, row.bookingId, booking.ownerId, BookingState.COMPLETED, "Final payment captured");
    await transitionBookingState(
      tx,
      row.bookingId,
      booking.ownerId,
      BookingState.PAYOUT_PENDING,
      "Awaiting provider payout"
    );
  }

  await createEscrowTransactionInTx(tx, row.bookingId, row.stage, updatedTx);
  await ensureProviderPayoutRowInTx(tx, row.bookingId);

  return { status: "captured_new" as const, transaction: updatedTx };
}

export async function confirmPayment(
  bookingId: string,
  orderId: string,
  paymentId: string,
  signature: string,
  stage: PaymentStage,
  actorId: string
) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const row = await tx.paymentTransaction.findFirst({
      where: {
        bookingId,
        orderId,
        stage
      }
    });

    if (!row) {
      throw new AppError("Payment order not found", StatusCodes.NOT_FOUND, "PAYMENT_NOT_FOUND");
    }

    const booking = await tx.booking.findUniqueOrThrow({
      where: { id: bookingId }
    });

    if (booking.ownerId !== actorId) {
      throw new AppError("Only booking owner can verify payment", StatusCodes.FORBIDDEN, "FORBIDDEN");
    }

    const result = await applyCapturedPaymentInTx(tx, orderId, paymentId, {
      signature,
      webhookEventId: null,
      requireSignature: true
    });

    if (result.status === "no_order") {
      throw new AppError("Payment order not found", StatusCodes.NOT_FOUND, "PAYMENT_NOT_FOUND");
    }

    return result.transaction;
  });
}

/**
 * Processes Razorpay `payment.captured` after HMAC verification of the webhook body.
 * Idempotent via `webhookDedupeKey` (Razorpay event `id` when present).
 */
export async function processWebhook(webhookDedupeKey: string, eventType: string, rawPayload: unknown) {
  if (paymentEnv.PAYMENT_WEBHOOK_PAUSED) {
    await appendPaymentAuditLog({
      severity: "WARNING",
      eventType: "WEBHOOK_PAUSED_BY_TOGGLE",
      message: "Webhook processing paused by env toggle",
      webhookEventId: webhookDedupeKey,
      metadata: { eventType }
    });
    return { ignored: true as const, reason: "webhook_paused" as const };
  }
  const existingEvent = await prisma.webhookEvent.findUnique({
    where: { dedupeKey: webhookDedupeKey }
  });
  if (existingEvent) {
    return { alreadyProcessed: true as const };
  }

  const parsed = extractPaymentCapturedEntity(rawPayload);

  try {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const alreadyLogged = await tx.webhookEvent.findUnique({
      where: { dedupeKey: webhookDedupeKey }
    });
    if (alreadyLogged) return { alreadyProcessed: true as const };

    const eventRow = await tx.webhookEvent.create({
      data: {
        dedupeKey: webhookDedupeKey,
        eventType,
        razorpayEventId: parsed?.razorpayEventId ?? null,
        orderId: parsed?.orderId ?? null,
        paymentId: parsed?.paymentId ?? null,
        payload: rawPayload as Prisma.InputJsonValue,
        status: "RECEIVED"
      }
    });

    if (eventType !== "payment.captured") {
      await tx.webhookEvent.update({
        where: { id: eventRow.id },
        data: {
          status: "IGNORED",
          errorMessage: "unsupported_event",
          processedAt: new Date()
        }
      });
      return { ignored: true as const, reason: "unsupported_event" as const };
    }

    if (!parsed) {
      await tx.webhookEvent.update({
        where: { id: eventRow.id },
        data: {
          status: "IGNORED",
          errorMessage: "unparseable_payload",
          processedAt: new Date()
        }
      });
      return { ignored: true as const, reason: "unparseable_payload" as const };
    }

    const result = await applyCapturedPaymentInTx(tx, parsed.orderId, parsed.paymentId, {
      requireSignature: false,
      webhookEventId: webhookDedupeKey
    });

    if (result.status === "no_order") {
      await tx.webhookEvent.update({
        where: { id: eventRow.id },
        data: {
          status: "IGNORED",
          errorMessage: "unknown_order",
          processedAt: new Date()
        }
      });
      return { ignored: true as const, reason: "unknown_order" as const };
    }

    await tx.webhookEvent.update({
      where: { id: eventRow.id },
      data: {
        bookingId: result.transaction.bookingId,
        status: "PROCESSED",
        processedAt: new Date()
      }
    });

      return { processed: true as const, reconciliation: result.status };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_webhook_processing_error";
    await prisma.webhookEvent.upsert({
      where: { dedupeKey: webhookDedupeKey },
      update: {
        status: "FAILED",
        errorMessage: message,
        processedAt: new Date()
      },
      create: {
        dedupeKey: webhookDedupeKey,
        eventType,
        payload: rawPayload as Prisma.InputJsonValue,
        status: "FAILED",
        errorMessage: message,
        processedAt: new Date()
      }
    });
    await appendPaymentAuditLog({
      severity: "CRITICAL",
      eventType: "WEBHOOK_PROCESSING_FAILED",
      message,
      webhookEventId: webhookDedupeKey,
      metadata: { eventType }
    });
    throw error;
  }
}

export async function releasePayout(bookingId: string, actorId: string) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const booking = await tx.booking.findUniqueOrThrow({
      where: { id: bookingId }
    });

    if (booking.providerId !== actorId) {
      throw new AppError("Only assigned provider can request payout release", StatusCodes.FORBIDDEN, "FORBIDDEN");
    }
    if (booking.state !== BookingState.PAYOUT_PENDING) {
      throw new AppError("Booking is not payout pending", 409, "INVALID_PAYOUT_STATE");
    }

    await transitionBookingState(tx, bookingId, actorId, BookingState.PAID_OUT, "Payout released");
    await tx.booking.update({
      where: { id: bookingId },
      data: { payoutReleasedAt: new Date() }
    });

    await tx.paymentTransaction.create({
      data: {
        bookingId,
        stage: PaymentStage.PAYOUT,
        status: PaymentStatus.CAPTURED,
        amount: booking.estimatedAmount,
        currency: "INR",
        idempotencyKey: `payout-${bookingId}`,
        metadata: { actorId }
      }
    });

    await tx.providerPayout.update({
      where: { bookingId },
      data: {
        status: "RELEASED",
        releasedAt: new Date(),
        notes: "Manual payout confirmed by internal route"
      }
    });

    await tx.escrowTransaction.updateMany({
      where: {
        bookingId,
        stage: { in: [PaymentStage.DEPOSIT, PaymentStage.FINAL] },
        status: PaymentStatus.CAPTURED
      },
      data: {
        releasedAt: new Date()
      }
    });
  });
}

async function createEscrowTransactionInTx(
  tx: Prisma.TransactionClient,
  bookingId: string,
  stage: PaymentStage,
  paymentTx: PaymentTransaction
) {
  if (stage === PaymentStage.PAYOUT) return;

  const existing = await tx.escrowTransaction.findUnique({
    where: { paymentTransactionId: paymentTx.id }
  });
  if (existing) return;

  const amountDecimal = new Prisma.Decimal(paymentTx.amount);
  const { platformFeePaise, providerSharePaise } = computePaymentBreakdown(amountDecimal, env.PLATFORM_COMMISSION_RATE);

  await tx.escrowTransaction.create({
    data: {
      bookingId,
      paymentTransactionId: paymentTx.id,
      stage,
      grossAmount: amountDecimal,
      platformFee: toRupeeDecimalFromPaise(platformFeePaise),
      providerAmount: toRupeeDecimalFromPaise(providerSharePaise),
      status: PaymentStatus.CAPTURED,
      metadata: {
        orderId: paymentTx.orderId,
        paymentId: paymentTx.paymentId,
        commissionRate: env.PLATFORM_COMMISSION_RATE
      }
    }
  });
}

async function ensureProviderPayoutRowInTx(tx: Prisma.TransactionClient, bookingId: string) {
  const booking = await tx.booking.findUnique({
    where: { id: bookingId }
  });
  if (!booking || booking.state !== BookingState.PAYOUT_PENDING) return;

  const existing = await tx.providerPayout.findUnique({
    where: { bookingId }
  });
  if (existing) return;

  const eligibleAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await tx.providerPayout.create({
    data: {
      bookingId: booking.id,
      providerId: booking.providerId,
      amount: booking.estimatedAmount,
      status: "READY_AFTER_DISPUTE_WINDOW",
      eligibleAt,
      metadata: {
        source: "payment_capture",
        disputeWindowHours: 24
      }
    }
  });
}

export async function getPaymentStatus(bookingId: string, actorId: string) {
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: {
      transactions: { orderBy: { createdAt: "desc" } },
      escrowTransactions: { orderBy: { createdAt: "desc" } },
      payouts: { orderBy: { createdAt: "desc" } }
    }
  });
  if (booking.ownerId !== actorId && booking.providerId !== actorId) {
    throw new AppError("Forbidden", StatusCodes.FORBIDDEN, "FORBIDDEN");
  }

  const deposit = booking.transactions.find((t) => t.stage === PaymentStage.DEPOSIT) ?? null;
  const final = booking.transactions.find((t) => t.stage === PaymentStage.FINAL) ?? null;
  const payout = booking.payouts[0] ?? null;

  return {
    bookingId: booking.id,
    bookingState: booking.state,
    hasPendingPayment: booking.state === BookingState.PENDING_PAYMENT || booking.state === BookingState.PAYMENT_LOCKED,
    deposit,
    final,
    escrow: booking.escrowTransactions,
    payout
  };
}
