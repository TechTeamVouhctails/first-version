import { BookingState, PaymentStage, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { razorpay } from "../config/razorpay.js";
import { paymentEnv } from "../config/paymentEnv.js";
import { appendPaymentAuditLog } from "../lib/payments/audit.js";
import { payoutStatuses, canAttemptAutomatedRouteTransfer, isDueForPayout } from "../lib/payments/payout.js";
import { computeBookingPaymentConsistency } from "../lib/payments/reconciliation.js";
import { type ReconciliationIssue, summarizeReconciliation } from "../lib/payments/reconciliationReport.js";
import { withPgAdvisoryLock } from "../utils/locking.js";
import { transitionBookingState } from "./bookingService.js";

type RunSummary = {
  scanned: number;
  released: number;
  manualPending: number;
  failed: number;
  skipped: number;
};

function getRetryCount(metadata: unknown): number {
  if (!metadata || typeof metadata !== "object") return 0;
  const raw = (metadata as { retryCount?: unknown }).retryCount;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
}

export async function processDueProviderPayouts(limit = 20): Promise<RunSummary> {
  if (!paymentEnv.PAYMENT_AUTOMATION_ENABLED) {
    return { scanned: 0, released: 0, manualPending: 0, failed: 0, skipped: 1 };
  }
  const gate = await withPgAdvisoryLock("payment:payout:process-due", async () => true);
  if (!gate.acquired) {
    logger.info("Skipped process-due run because another worker holds lock");
    return { scanned: 0, released: 0, manualPending: 0, failed: 0, skipped: 1 };
  }
  const now = new Date();
  const due = await prisma.providerPayout.findMany({
    where: {
      status: payoutStatuses.READY_AFTER_DISPUTE_WINDOW,
      eligibleAt: { lte: now }
    },
    orderBy: { eligibleAt: "asc" },
    take: Math.max(1, Math.min(limit, 100)),
    include: {
      booking: {
        include: {
          provider: { include: { providerProfile: true } }
        }
      }
    }
  });

  const summary: RunSummary = { scanned: due.length, released: 0, manualPending: 0, failed: 0, skipped: 0 };
  for (const payout of due) {
    try {
      const result = await executeSinglePayout(payout.id);
      summary[result] += 1;
    } catch (error) {
      summary.failed += 1;
      logger.error({ payoutId: payout.id, error }, "Payout automation failed");
      await appendPaymentAuditLog({
        severity: "CRITICAL",
        eventType: "PAYOUT_AUTOMATION_FAILURE",
        message: "Payout automation execution failed",
        payoutId: payout.id,
        bookingId: payout.bookingId,
        metadata: { error: error instanceof Error ? error.message : "unknown_error" }
      });
    }
  }
  return summary;
}

async function executeSinglePayout(payoutId: string): Promise<"released" | "manualPending" | "failed" | "skipped"> {
  const lock = await withPgAdvisoryLock(`payment:payout:${payoutId}`, async () => {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const payout = await tx.providerPayout.findUnique({
      where: { id: payoutId },
      include: {
        booking: {
          include: {
            provider: { include: { providerProfile: true } }
          }
        }
      }
    });
      if (!payout) return "skipped";
    if (payout.status !== payoutStatuses.READY_AFTER_DISPUTE_WINDOW) return "skipped";
    if (!isDueForPayout(payout.status, payout.eligibleAt, new Date())) return "skipped";
    if (payout.booking.state !== BookingState.PAYOUT_PENDING) return "skipped";

    const linkedAccountId = payout.booking.provider.providerProfile?.routeLinkedAccountId ?? null;
    const canAuto = canAttemptAutomatedRouteTransfer(env.RAZORPAY_ROUTE_SPLITS_ENABLED, linkedAccountId);
    if (!canAuto) {
      await tx.providerPayout.update({
        where: { id: payout.id },
        data: {
          status: payoutStatuses.MANUAL_PENDING,
          notes: "Awaiting manual payout: Route linked account missing or Route automation disabled",
          metadata: {
            ...(payout.metadata && typeof payout.metadata === "object" ? (payout.metadata as object) : {}),
            movedToManualAt: new Date().toISOString()
          }
        }
      });
      await appendPaymentAuditLog({
        severity: "WARNING",
        eventType: "PAYOUT_MANUAL_FALLBACK",
        message: "Moved payout to manual pending due to missing Route readiness",
        payoutId: payout.id,
        bookingId: payout.bookingId,
        metadata: {
          routeSplitsEnabled: env.RAZORPAY_ROUTE_SPLITS_ENABLED,
          linkedAccountIdPresent: Boolean(linkedAccountId)
        }
      });
      return "manualPending";
    }

      if (Number(payout.amount) <= 0) {
        await tx.providerPayout.update({
          where: { id: payout.id },
          data: {
            status: payoutStatuses.RETRYABLE_FAILED,
            notes: "Invalid payout amount; requires manual intervention"
          }
        });
        await appendPaymentAuditLog({
          severity: "CRITICAL",
          eventType: "PAYOUT_INVALID_AMOUNT",
          message: "Payout amount must be greater than zero",
          payoutId: payout.id,
          bookingId: payout.bookingId,
          metadata: { amount: payout.amount.toString() }
        });
        return "failed";
      }

    try {
      if (!paymentEnv.PAYMENT_TRANSFER_EXECUTION_ENABLED) {
        await appendPaymentAuditLog({
          severity: "WARNING",
          eventType: "PAYOUT_BLOCKED_BY_TOGGLE",
          message: "Transfer execution disabled by env toggle",
          payoutId: payout.id,
          bookingId: payout.bookingId
        });
        return "skipped";
      }

      if (paymentEnv.PAYMENT_PAYOUT_DRY_RUN) {
        await appendPaymentAuditLog({
          severity: "INFO",
          eventType: "PAYOUT_DRY_RUN",
          message: "Dry-run enabled; transfer not executed",
          payoutId: payout.id,
          bookingId: payout.bookingId
        });
        return "skipped";
      }

      await tx.providerPayout.update({
        where: { id: payout.id },
        data: { status: payoutStatuses.PROCESSING }
      });

      const transfer = await razorpay.transfers.create({
        account: linkedAccountId!,
        amount: Math.round(Number(payout.amount) * 100),
        currency: "INR",
        notes: {
          bookingId: payout.bookingId,
          payoutId: payout.id,
          source: "automated_dispute_window_release"
        }
      } as Parameters<(typeof razorpay)["transfers"]["create"]>[0]);

      await transitionBookingState(tx, payout.bookingId, payout.providerId, BookingState.PAID_OUT, "Automated Route payout released");
      await tx.booking.update({
        where: { id: payout.bookingId },
        data: { payoutReleasedAt: new Date() }
      });
      await tx.providerPayout.update({
        where: { id: payout.id },
        data: {
          status: payoutStatuses.RELEASED,
          releasedAt: new Date(),
          reference: transfer.id,
          notes: "Released via Razorpay Route transfer"
        }
      });
      await appendPaymentAuditLog({
        severity: "INFO",
        eventType: "PAYOUT_RELEASED",
        message: "Automated payout released via Route transfer",
        payoutId: payout.id,
        bookingId: payout.bookingId,
        transferId: transfer.id,
        stage: "PAYOUT"
      });
      await tx.paymentTransaction.upsert({
        where: { idempotencyKey: `payout-auto-${payout.bookingId}` },
        update: {},
        create: {
          bookingId: payout.bookingId,
          stage: PaymentStage.PAYOUT,
          status: PaymentStatus.CAPTURED,
          amount: payout.amount,
          currency: "INR",
          idempotencyKey: `payout-auto-${payout.bookingId}`,
          metadata: {
            providerPayoutId: payout.id,
            transferId: transfer.id
          }
        }
      });
      await tx.escrowTransaction.updateMany({
        where: {
          bookingId: payout.bookingId,
          status: PaymentStatus.CAPTURED,
          stage: { in: [PaymentStage.DEPOSIT, PaymentStage.FINAL] }
        },
        data: { releasedAt: new Date() }
      });

      logger.info({ payoutId: payout.id, transferId: transfer.id, bookingId: payout.bookingId }, "Automated payout released");
      return "released";
    } catch (error) {
      const retryCount = getRetryCount(payout.metadata) + 1;
      await tx.providerPayout.update({
        where: { id: payout.id },
        data: {
          status: payoutStatuses.RETRYABLE_FAILED,
          notes: "Route transfer failed; retry possible",
          metadata: {
            ...(payout.metadata && typeof payout.metadata === "object" ? (payout.metadata as object) : {}),
            retryCount,
            lastRetryAt: new Date().toISOString(),
            lastError: error instanceof Error ? error.message : "unknown_error"
          }
        }
      });
      logger.warn({ payoutId: payout.id, retryCount, error }, "Automated payout attempt failed");
      await appendPaymentAuditLog({
        severity: "WARNING",
        eventType: "PAYOUT_RETRYABLE_FAILED",
        message: "Automated payout failed and marked retryable",
        payoutId: payout.id,
        bookingId: payout.bookingId,
        metadata: {
          retryCount,
          error: error instanceof Error ? error.message : "unknown_error"
        }
      });
      return "failed";
    }
    });
  });
  if (!lock.acquired) return "skipped";
  return lock.result ?? "skipped";
}

export async function retryFailedProviderPayouts(limit = 20): Promise<RunSummary> {
  const gate = await withPgAdvisoryLock("payment:payout:retry-failed", async () => true);
  if (!gate.acquired) {
    logger.info("Skipped retry-failed run because another worker holds lock");
    return { scanned: 0, released: 0, manualPending: 0, failed: 0, skipped: 1 };
  }
  const failed = await prisma.providerPayout.findMany({
    where: { status: payoutStatuses.RETRYABLE_FAILED },
    orderBy: { updatedAt: "asc" },
    take: Math.max(1, Math.min(limit, 100))
  });
  const summary: RunSummary = { scanned: failed.length, released: 0, manualPending: 0, failed: 0, skipped: 0 };
  for (const payout of failed) {
    await prisma.providerPayout.update({
      where: { id: payout.id },
      data: { status: payoutStatuses.READY_AFTER_DISPUTE_WINDOW }
    });
    const result = await executeSinglePayout(payout.id);
    summary[result] += 1;
  }
  return summary;
}

export async function reconcileBookingPayments(bookingId: string) {
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: {
      transactions: true,
      escrowTransactions: true,
      payouts: true,
      webhookEvents: {
        orderBy: { createdAt: "desc" },
        take: 100
      }
    }
  });

  const consistencyIssues = computeBookingPaymentConsistency({
    payments: booking.transactions.map((t) => ({
      id: t.id,
      stage: t.stage,
      status: t.status,
      orderId: t.orderId,
      paymentId: t.paymentId
    })),
    escrowRows: booking.escrowTransactions.map((e) => ({
      paymentTransactionId: e.paymentTransactionId
    }))
  });

  const unknownOrderEvents = booking.webhookEvents.filter((w) => w.errorMessage === "unknown_order").length;
  const duplicateWebhookPayloads = booking.webhookEvents.filter((w) => w.status === "FAILED").length;
  const stuckProcessingPayouts = booking.payouts.filter(
    (p) => p.status === payoutStatuses.PROCESSING && Date.now() - p.updatedAt.getTime() > 15 * 60 * 1000
  ).length;
  const stuckPaymentLocked =
    booking.state === BookingState.PAYMENT_LOCKED && booking.paymentLockedAt
      ? Date.now() - booking.paymentLockedAt.getTime() > 15 * 60 * 1000
      : false;

  return {
    bookingId,
    bookingState: booking.state,
    consistencyIssues,
    unknownOrderEvents,
    failedWebhookEvents: duplicateWebhookPayloads,
    stuckProcessingPayouts,
    stuckPaymentLocked,
    ok:
      consistencyIssues.length === 0 &&
      unknownOrderEvents === 0 &&
      duplicateWebhookPayloads === 0 &&
      stuckProcessingPayouts === 0 &&
      !stuckPaymentLocked
  };
}

export async function runGlobalPaymentReconciliation(limit = 200) {
  const issues: ReconciliationIssue[] = [];
  const bookings = await prisma.booking.findMany({
    take: Math.max(1, Math.min(1000, limit)),
    orderBy: { updatedAt: "desc" },
    include: {
      transactions: true,
      escrowTransactions: true,
      payouts: true
    }
  });

  for (const booking of bookings) {
    const consistency = computeBookingPaymentConsistency({
      payments: booking.transactions.map((t) => ({
        id: t.id,
        stage: t.stage,
        status: t.status,
        orderId: t.orderId,
        paymentId: t.paymentId
      })),
      escrowRows: booking.escrowTransactions.map((e) => ({ paymentTransactionId: e.paymentTransactionId }))
    });
    for (const code of consistency) {
      issues.push({
        severity: "WARNING",
        code,
        message: `Consistency issue detected: ${code}`,
        bookingId: booking.id
      });
    }

    const depositCaptured = booking.transactions.some((t) => t.stage === PaymentStage.DEPOSIT && t.status === PaymentStatus.CAPTURED);
    const finalCaptured = booking.transactions.some((t) => t.stage === PaymentStage.FINAL && t.status === PaymentStatus.CAPTURED);
    if (finalCaptured && !depositCaptured) {
      issues.push({
        severity: "CRITICAL",
        code: "final_without_deposit",
        message: "Final payment captured without deposit capture",
        bookingId: booking.id
      });
    }

    const orphanEscrow = booking.escrowTransactions.some(
      (e) => !booking.transactions.some((t) => t.id === e.paymentTransactionId)
    );
    if (orphanEscrow) {
      issues.push({
        severity: "CRITICAL",
        code: "orphan_escrow_row",
        message: "Escrow row exists without linked payment transaction",
        bookingId: booking.id
      });
    }

    const duplicateTransferIds = new Set<string>();
    for (const payout of booking.payouts) {
      if (!payout.reference) continue;
      if (duplicateTransferIds.has(payout.reference)) {
        issues.push({
          severity: "CRITICAL",
          code: "duplicate_transfer_reference",
          message: "Duplicate transfer reference in payout records",
          bookingId: booking.id
        });
      }
      duplicateTransferIds.add(payout.reference);
    }

    const processingPayout = booking.payouts.find(
      (p) => p.status === payoutStatuses.PROCESSING && Date.now() - p.updatedAt.getTime() > 15 * 60 * 1000
    );
    if (processingPayout) {
      issues.push({
        severity: "WARNING",
        code: "stale_processing_payout",
        message: "Payout stuck in PROCESSING for over 15 minutes",
        bookingId: booking.id
      });
    }

    if (
      booking.state === BookingState.PAYMENT_LOCKED &&
      booking.paymentLockedAt &&
      Date.now() - booking.paymentLockedAt.getTime() > 15 * 60 * 1000
    ) {
      issues.push({
        severity: "WARNING",
        code: "stuck_payment_locked",
        message: "Booking remained PAYMENT_LOCKED for over 15 minutes",
        bookingId: booking.id
      });
    }
  }

  for (const issue of issues) {
    if (issue.severity !== "INFO") {
      await appendPaymentAuditLog({
        severity: issue.severity,
        eventType: "GLOBAL_RECONCILIATION_ISSUE",
        message: issue.message,
        bookingId: issue.bookingId ?? null,
        metadata: { code: issue.code }
      });
    }
  }

  const report = summarizeReconciliation(issues, bookings.length);
  logger.info({ summary: report.summary }, "Global payment reconciliation completed");
  return report;
}
