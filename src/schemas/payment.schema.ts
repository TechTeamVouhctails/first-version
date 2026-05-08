import { PaymentStage } from "@prisma/client";
import { z } from "zod";

export const createOrderSchema = z.object({
  params: z.object({}).default({}),
  query: z.object({}).default({}),
  body: z.object({
    bookingId: z.string().cuid(),
    stage: z.nativeEnum(PaymentStage).refine((s) => s !== "PAYOUT", "Only DEPOSIT and FINAL allowed")
  })
});

export const verifyPaymentSchema = z.object({
  params: z.object({}).default({}),
  query: z.object({}).default({}),
  body: z.object({
    bookingId: z.string().cuid(),
    orderId: z.string().min(5),
    paymentId: z.string().min(5),
    signature: z.string().min(10),
    stage: z.nativeEnum(PaymentStage).refine((s) => s !== "PAYOUT", "Only DEPOSIT and FINAL allowed")
  })
});

export const payoutReleaseSchema = z.object({
  params: z.object({
    bookingId: z.string().cuid()
  }),
  query: z.object({}).default({}),
  body: z.object({}).default({})
});

export const paymentStatusSchema = z.object({
  params: z.object({
    bookingId: z.string().cuid()
  }),
  query: z.object({}).default({}),
  body: z.object({}).default({})
});

export const internalPayoutBatchSchema = z.object({
  params: z.object({}).default({}),
  query: z.object({}).default({}),
  body: z
    .object({
      limit: z.number().int().min(1).max(100).optional()
    })
    .default({})
});

export const reconcileBookingSchema = z.object({
  params: z.object({
    bookingId: z.string().cuid()
  }),
  query: z.object({}).default({}),
  body: z.object({}).default({})
});

export const globalReconcileSchema = z.object({
  params: z.object({}).default({}),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(1000).optional()
  }),
  body: z.object({}).default({})
});

export const replayWebhookSchema = z.object({
  params: z.object({}).default({}),
  query: z.object({}).default({}),
  body: z.object({
    dedupeKey: z.string().min(5)
  })
});

export const manualPayoutReleaseSchema = z.object({
  params: z.object({
    bookingId: z.string().cuid()
  }),
  query: z.object({}).default({}),
  body: z.object({
    reference: z.string().min(3).optional()
  })
});

export const manualPayoutStatusSchema = z.object({
  params: z.object({
    bookingId: z.string().cuid()
  }),
  query: z.object({}).default({}),
  body: z.object({
    status: z.enum(["RETRYABLE_FAILED", "READY_AFTER_DISPUTE_WINDOW"])
  })
});

export const repairBookingStateSchema = z.object({
  params: z.object({
    bookingId: z.string().cuid()
  }),
  query: z.object({}).default({}),
  body: z.object({}).default({})
});

export const paymentHealthSchema = z.object({
  params: z.object({}).default({}),
  query: z.object({}).default({}),
  body: z.object({}).default({})
});

export const reconciliationExportSchema = z.object({
  params: z.object({}).default({}),
  query: z.object({
    format: z.enum(["json", "csv"]).default("json"),
    limit: z.coerce.number().int().min(1).max(1000).optional()
  }),
  body: z.object({}).default({})
});

export const failureSimulationSchema = z.object({
  params: z.object({}).default({}),
  query: z.object({}).default({}),
  body: z.object({
    type: z.enum(["webhook_storm", "payout_failure", "reconciliation_mismatch", "stale_lock"]),
    bookingId: z.string().cuid().optional(),
    dedupeKey: z.string().optional(),
    eventType: z.string().optional(),
    payload: z.unknown().optional(),
    attempts: z.number().int().min(1).max(100).optional(),
    lockKey: z.string().optional(),
    holdMs: z.number().int().min(100).max(15000).optional()
  })
});
