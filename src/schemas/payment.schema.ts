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
