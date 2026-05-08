import { BookingState } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { paymentEnv } from "../config/paymentEnv.js";
import { getPaymentAutomationRuntimeStatus } from "../jobs/paymentAutomationJob.js";

export async function getPaymentHealthSummary() {
  const [failedPayouts, staleProcessingPayouts, stuckBookings, webhookFailures, mismatchCount] = await Promise.all([
    prisma.providerPayout.count({ where: { status: "RETRYABLE_FAILED" } }),
    prisma.providerPayout.count({
      where: {
        status: "PROCESSING",
        updatedAt: { lte: new Date(Date.now() - 15 * 60 * 1000) }
      }
    }),
    prisma.booking.count({
      where: {
        state: BookingState.PAYMENT_LOCKED,
        paymentLockedAt: { lte: new Date(Date.now() - 15 * 60 * 1000) }
      }
    }),
    prisma.webhookEvent.count({ where: { status: "FAILED" } }),
    prisma.paymentAuditLog.count({ where: { eventType: "GLOBAL_RECONCILIATION_ISSUE" } })
  ]);

  return {
    scheduler: getPaymentAutomationRuntimeStatus(),
    stalePayoutsCount: staleProcessingPayouts,
    failedPayoutsCount: failedPayouts,
    stuckBookingsCount: stuckBookings,
    reconciliationMismatchCount: mismatchCount,
    webhookFailureCount: webhookFailures,
    flags: {
      automationEnabled: paymentEnv.PAYMENT_AUTOMATION_ENABLED,
      transferExecutionEnabled: paymentEnv.PAYMENT_TRANSFER_EXECUTION_ENABLED,
      payoutDryRun: paymentEnv.PAYMENT_PAYOUT_DRY_RUN,
      webhookPaused: paymentEnv.PAYMENT_WEBHOOK_PAUSED
    }
  };
}
