import { BookingState, PaymentStage, PaymentStatus, Prisma } from "@prisma/client";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../config/prisma.js";
import { razorpay } from "../config/razorpay.js";
import { env } from "../config/env.js";
import { hmacSha256 } from "../utils/crypto.js";
import { AppError } from "../utils/errors.js";
import { transitionBookingState } from "./bookingService.js";

const ORDER_RECEIPT_PREFIX = "vouch-booking";

export async function createPaymentOrder(bookingId: string, stage: PaymentStage, idempotencyKey: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
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

    const booking = await tx.booking.findUniqueOrThrow({
      where: { id: bookingId }
    });

    if (booking.ownerId !== actorId) {
      throw new AppError("Only booking owner can pay", StatusCodes.FORBIDDEN, "FORBIDDEN");
    }

    if (stage === PaymentStage.DEPOSIT && booking.state !== BookingState.CONFIRMED && booking.state !== BookingState.OTP_READY) {
      throw new AppError("Deposit can only be paid after confirmation", 409, "INVALID_PAYMENT_STAGE");
    }
    if (stage === PaymentStage.FINAL && booking.state !== BookingState.PENDING_PAYMENT) {
      throw new AppError("Final payment can only be made at pending payment", 409, "INVALID_PAYMENT_STAGE");
    }

    const amount = stage === PaymentStage.DEPOSIT ? booking.depositAmount : booking.finalAmount;
    const order = await razorpay.orders.create({
      amount: Number(amount) * 100,
      currency: "INR",
      receipt: `${ORDER_RECEIPT_PREFIX}-${booking.id}-${stage}-${Date.now()}`,
      notes: {
        bookingId,
        stage
      }
    });

    const transaction = await tx.paymentTransaction.create({
      data: {
        bookingId,
        stage,
        amount,
        status: PaymentStatus.CREATED,
        currency: "INR",
        orderId: order.id,
        idempotencyKey,
        metadata: {
          actorId
        }
      }
    });

    return { transaction, order };
  });
}

export function verifyRazorpaySignature(orderId: string, paymentId: string, signature: string): boolean {
  const digest = hmacSha256(`${orderId}|${paymentId}`, env.RAZORPAY_KEY_SECRET);
  return digest === signature;
}

export async function confirmPayment(
  bookingId: string,
  orderId: string,
  paymentId: string,
  signature: string,
  stage: PaymentStage,
  actorId: string
) {
  if (!verifyRazorpaySignature(orderId, paymentId, signature)) {
    throw new AppError("Invalid payment signature", StatusCodes.BAD_REQUEST, "INVALID_SIGNATURE");
  }

  return prisma.$transaction(async (tx) => {
    const txRow = await tx.paymentTransaction.findFirst({
      where: {
        bookingId,
        orderId,
        stage
      }
    });

    if (!txRow) {
      throw new AppError("Payment order not found", StatusCodes.NOT_FOUND, "PAYMENT_NOT_FOUND");
    }

    if (txRow.status === PaymentStatus.CAPTURED && txRow.paymentId === paymentId) {
      return txRow;
    }

    const booking = await tx.booking.findUniqueOrThrow({
      where: { id: bookingId }
    });

    if (booking.ownerId !== actorId) {
      throw new AppError("Only booking owner can verify payment", StatusCodes.FORBIDDEN, "FORBIDDEN");
    }

    const updatedTx = await tx.paymentTransaction.update({
      where: { id: txRow.id },
      data: {
        paymentId,
        signature,
        status: PaymentStatus.CAPTURED
      }
    });

    if (stage === PaymentStage.DEPOSIT) {
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          depositPaidAt: new Date()
        }
      });
    }

    if (stage === PaymentStage.FINAL) {
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          finalPaidAt: new Date()
        }
      });
      await transitionBookingState(tx, bookingId, actorId, BookingState.COMPLETED, "Final payment captured");
      await transitionBookingState(tx, bookingId, actorId, BookingState.PAYOUT_PENDING, "Awaiting provider payout");
    }

    return updatedTx;
  });
}

export async function processWebhook(eventId: string, eventType: string, payload: Prisma.InputJsonValue) {
  const existing = await prisma.paymentTransaction.findFirst({
    where: { webhookEventId: eventId }
  });
  if (existing) {
    return { alreadyProcessed: true };
  }

  if (eventType !== "payment.captured") {
    return { ignored: true };
  }

  const entity = (payload as { payload?: { payment?: { entity?: { order_id?: string; id?: string } } } })?.payload?.payment?.entity;
  const orderId = entity?.order_id;
  const paymentId = entity?.id;
  if (!orderId || !paymentId) {
    throw new AppError("Invalid webhook payload", StatusCodes.BAD_REQUEST, "INVALID_WEBHOOK");
  }

  await prisma.paymentTransaction.updateMany({
    where: { orderId },
    data: {
      paymentId,
      status: PaymentStatus.CAPTURED,
      webhookEventId: eventId
    }
  });

  return { processed: true };
}

export async function releasePayout(bookingId: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
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
        amount: booking.finalAmount,
        currency: "INR",
        idempotencyKey: `payout-${bookingId}`,
        metadata: { actorId }
      }
    });
  });
}
