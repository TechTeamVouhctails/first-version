-- Add PAYMENT_LOCKED state between pending final payment and completion.
ALTER TYPE "BookingState" ADD VALUE IF NOT EXISTS 'PAYMENT_LOCKED';

ALTER TABLE "Booking" ADD COLUMN "paymentLockedAt" TIMESTAMP(3);

CREATE TABLE "EscrowTransaction" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "paymentTransactionId" TEXT NOT NULL,
  "stage" "PaymentStage" NOT NULL,
  "grossAmount" DECIMAL(10,2) NOT NULL,
  "platformFee" DECIMAL(10,2) NOT NULL,
  "providerAmount" DECIMAL(10,2) NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'CAPTURED',
  "releasedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EscrowTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebhookEvent" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT,
  "dedupeKey" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "razorpayEventId" TEXT,
  "orderId" TEXT,
  "paymentId" TEXT,
  "signature" TEXT,
  "payload" JSONB,
  "status" TEXT NOT NULL,
  "errorMessage" TEXT,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderPayout" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "status" TEXT NOT NULL,
  "payoutMode" TEXT NOT NULL DEFAULT 'MANUAL_BANK_TRANSFER',
  "eligibleAt" TIMESTAMP(3) NOT NULL,
  "releasedAt" TIMESTAMP(3),
  "reference" TEXT,
  "notes" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProviderPayout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EscrowTransaction_paymentTransactionId_key" ON "EscrowTransaction"("paymentTransactionId");
CREATE UNIQUE INDEX "WebhookEvent_dedupeKey_key" ON "WebhookEvent"("dedupeKey");
CREATE UNIQUE INDEX "ProviderPayout_bookingId_key" ON "ProviderPayout"("bookingId");

CREATE INDEX "EscrowTransaction_bookingId_stage_status_idx" ON "EscrowTransaction"("bookingId", "stage", "status");
CREATE INDEX "WebhookEvent_eventType_createdAt_idx" ON "WebhookEvent"("eventType", "createdAt");
CREATE INDEX "WebhookEvent_bookingId_createdAt_idx" ON "WebhookEvent"("bookingId", "createdAt");
CREATE INDEX "ProviderPayout_providerId_status_eligibleAt_idx" ON "ProviderPayout"("providerId", "status", "eligibleAt");

ALTER TABLE "EscrowTransaction"
ADD CONSTRAINT "EscrowTransaction_bookingId_fkey"
FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EscrowTransaction"
ADD CONSTRAINT "EscrowTransaction_paymentTransactionId_fkey"
FOREIGN KEY ("paymentTransactionId") REFERENCES "PaymentTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WebhookEvent"
ADD CONSTRAINT "WebhookEvent_bookingId_fkey"
FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProviderPayout"
ADD CONSTRAINT "ProviderPayout_bookingId_fkey"
FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProviderPayout"
ADD CONSTRAINT "ProviderPayout_providerId_fkey"
FOREIGN KEY ("providerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
