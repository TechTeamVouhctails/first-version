import { z } from "zod";

const boolish = z
  .union([z.string(), z.boolean()])
  .optional()
  .transform((value) => value === true || value === "true" || value === "1");

const paymentEnvSchema = z.object({
  RAZORPAY_KEY_ID: z.string().min(1),
  RAZORPAY_KEY_SECRET: z.string().min(1),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1),
  INTERNAL_PAYOUT_TOKEN: z.string().min(8),
  PLATFORM_COMMISSION_RATE: z.coerce.number().min(0).max(1).default(0.175),
  PAYMENT_AUTOMATION_ENABLED: boolish.default(false),
  PAYMENT_AUTOMATION_PROCESS_DUE_INTERVAL_MS: z.coerce.number().int().min(10_000).max(3_600_000).default(60_000),
  PAYMENT_AUTOMATION_RETRY_INTERVAL_MS: z.coerce.number().int().min(10_000).max(3_600_000).default(180_000),
  PAYMENT_TRANSFER_EXECUTION_ENABLED: boolish.default(true),
  PAYMENT_PAYOUT_DRY_RUN: boolish.default(false),
  PAYMENT_WEBHOOK_PAUSED: boolish.default(false),
  PAYMENT_FAIL_SIMULATION_ENABLED: boolish.default(false)
});

const parsed = paymentEnvSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid payment environment: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`);
}

export const paymentEnv = parsed.data;
