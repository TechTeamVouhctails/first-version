import { BookingState, PaymentStatus } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { appendPaymentAuditLog } from "./audit.js";
import { payoutStatuses } from "./payout.js";
import { processWebhook } from "../../services/paymentService.js";
import { transitionBookingState } from "../../services/bookingService.js";

export async function replayWebhookByDedupeKey(dedupeKey: string) {
  const event = await prisma.webhookEvent.findUniqueOrThrow({
    where: { dedupeKey }
  });
  const replayDedupeKey = `${dedupeKey}:replay:${Date.now()}`;
  const result = await processWebhook(replayDedupeKey, event.eventType, event.payload);
  await appendPaymentAuditLog({
    severity: "WARNING",
    eventType: "WEBHOOK_REPLAY_TRIGGERED",
    message: "Webhook replay triggered manually",
    webhookEventId: event.id,
    bookingId: event.bookingId,
    metadata: { sourceDedupeKey: dedupeKey, replayDedupeKey }
  });
  return { replayDedupeKey, result };
}

export async function manuallyMarkPayoutReleased(bookingId: string, reference?: string | null) {
  const payout = await prisma.providerPayout.findUniqueOrThrow({
    where: { bookingId },
    include: { booking: true }
  });

  await prisma.$transaction(async (tx) => {
    if (payout.booking.state !== BookingState.PAID_OUT) {
      await transitionBookingState(tx, bookingId, payout.providerId, BookingState.PAID_OUT, "Manual recovery payout release");
    }
    await tx.booking.update({
      where: { id: bookingId },
      data: { payoutReleasedAt: new Date() }
    });
    await tx.providerPayout.update({
      where: { bookingId },
      data: {
        status: payoutStatuses.RELEASED,
        releasedAt: new Date(),
        reference: reference ?? payout.reference
      }
    });
  });

  await appendPaymentAuditLog({
    severity: "WARNING",
    eventType: "PAYOUT_MANUALLY_RELEASED",
    message: "Payout marked released via recovery endpoint",
    payoutId: payout.id,
    bookingId,
    transferId: reference ?? payout.reference
  });
}

export async function manuallySetPayoutStatus(bookingId: string, status: "RETRYABLE_FAILED" | "READY_AFTER_DISPUTE_WINDOW") {
  const payout = await prisma.providerPayout.findUniqueOrThrow({ where: { bookingId } });
  await prisma.providerPayout.update({
    where: { bookingId },
    data: {
      status
    }
  });
  await appendPaymentAuditLog({
    severity: "WARNING",
    eventType: "PAYOUT_MANUAL_STATUS_OVERRIDE",
    message: `Payout status set to ${status}`,
    payoutId: payout.id,
    bookingId
  });
}

export async function repairBookingPaymentState(bookingId: string) {
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { transactions: true }
  });
  const finalCaptured = booking.transactions.some((t) => t.stage === "FINAL" && t.status === PaymentStatus.CAPTURED);
  const depositCaptured = booking.transactions.some((t) => t.stage === "DEPOSIT" && t.status === PaymentStatus.CAPTURED);

  await prisma.$transaction(async (tx) => {
    if (finalCaptured && !depositCaptured) {
      throw new Error("Cannot repair state: final captured without deposit captured");
    }
    if (finalCaptured && booking.state !== BookingState.PAYOUT_PENDING && booking.state !== BookingState.PAID_OUT) {
      await transitionBookingState(tx, booking.id, booking.ownerId, BookingState.PAYOUT_PENDING, "Manual payment-state repair");
    }
  });

  await appendPaymentAuditLog({
    severity: "WARNING",
    eventType: "BOOKING_STATE_REPAIRED",
    message: "Booking payment state repair endpoint executed",
    bookingId
  });
}
