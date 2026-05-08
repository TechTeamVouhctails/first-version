import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { logger } from "../../config/logger.js";

export type AuditSeverity = "INFO" | "WARNING" | "CRITICAL";

type AuditInput = {
  severity: AuditSeverity;
  eventType: string;
  message: string;
  bookingId?: string | null;
  paymentId?: string | null;
  payoutId?: string | null;
  webhookEventId?: string | null;
  transferId?: string | null;
  stage?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export async function appendPaymentAuditLog(input: AuditInput) {
  await prisma.paymentAuditLog.create({
    data: {
      severity: input.severity,
      eventType: input.eventType,
      message: input.message,
      bookingId: input.bookingId ?? null,
      paymentId: input.paymentId ?? null,
      payoutId: input.payoutId ?? null,
      webhookEventId: input.webhookEventId ?? null,
      transferId: input.transferId ?? null,
      stage: input.stage ?? null,
      metadata: input.metadata ?? null
    }
  });
  logger.info(
    {
      severity: input.severity,
      eventType: input.eventType,
      bookingId: input.bookingId ?? null,
      paymentId: input.paymentId ?? null,
      payoutId: input.payoutId ?? null,
      webhookEventId: input.webhookEventId ?? null,
      transferId: input.transferId ?? null,
      stage: input.stage ?? null
    },
    "Payment audit log appended"
  );
}
