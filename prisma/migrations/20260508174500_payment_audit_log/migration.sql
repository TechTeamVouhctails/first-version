CREATE TABLE "PaymentAuditLog" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT,
  "paymentId" TEXT,
  "payoutId" TEXT,
  "webhookEventId" TEXT,
  "transferId" TEXT,
  "stage" TEXT,
  "severity" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PaymentAuditLog_bookingId_createdAt_idx" ON "PaymentAuditLog"("bookingId", "createdAt");
CREATE INDEX "PaymentAuditLog_payoutId_createdAt_idx" ON "PaymentAuditLog"("payoutId", "createdAt");
CREATE INDEX "PaymentAuditLog_paymentId_createdAt_idx" ON "PaymentAuditLog"("paymentId", "createdAt");
CREATE INDEX "PaymentAuditLog_webhookEventId_createdAt_idx" ON "PaymentAuditLog"("webhookEventId", "createdAt");
CREATE INDEX "PaymentAuditLog_severity_createdAt_idx" ON "PaymentAuditLog"("severity", "createdAt");
