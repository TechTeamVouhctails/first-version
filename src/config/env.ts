import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
dotenv.config({ path: path.join(repoRoot, ".env") });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(8080),
  DATABASE_URL: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_JWKS_URL: z.string().url().optional(),
  RAZORPAY_KEY_ID: z.string().min(1).optional(),
  RAZORPAY_KEY_SECRET: z.string().min(1).optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1).optional(),
  INTERNAL_PAYOUT_TOKEN: z.string().min(1),
  /** Market fee on gross (e.g. 0.175 = 17.5%). Omit to use pilot default from product spec. */
  PLATFORM_COMMISSION_RATE: z.coerce.number().min(0).max(1).optional(),
  CORS_ORIGIN: z
    .string()
    .default("http://localhost:3000")
    .describe("Comma-separated allowed browser origins for REST + Socket.IO")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables");
}

const { NODE_ENV } = parsed.data;
const isProduction = NODE_ENV === "production";

if (isProduction && !parsed.data.SUPABASE_JWKS_URL) {
  throw new Error("SUPABASE_JWKS_URL is required in production.");
}
if (
  isProduction &&
  (!parsed.data.RAZORPAY_KEY_ID || !parsed.data.RAZORPAY_KEY_SECRET || !parsed.data.RAZORPAY_WEBHOOK_SECRET)
) {
  throw new Error("RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, and RAZORPAY_WEBHOOK_SECRET are required in production.");
}

const supabaseOrigin = parsed.data.SUPABASE_URL.replace(/\/$/, "");
const supabaseJwksUrl =
  parsed.data.SUPABASE_JWKS_URL ?? `${supabaseOrigin}/auth/v1/.well-known/jwks.json`;

const razorpayKeyId = parsed.data.RAZORPAY_KEY_ID ?? "rzp_test_dev_placeholder";
const razorpayKeySecret = parsed.data.RAZORPAY_KEY_SECRET ?? "rzp_secret_dev_placeholder";
const razorpayWebhookSecret = parsed.data.RAZORPAY_WEBHOOK_SECRET ?? "whsec_dev_placeholder";

const corsOrigins = parsed.data.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean);

const dbUrl = parsed.data.DATABASE_URL;
if (
  dbUrl.includes("[PASSWORD]") ||
  dbUrl.includes("[SUPABASE_REF]") ||
  dbUrl.includes("<URL_ENCODED_DB_PASSWORD>")
) {
  throw new Error(
    "DATABASE_URL contains placeholder values. Set a real Postgres URL (local Docker or Supabase) and URL-encode special characters in the password."
  );
}

const platformCommissionRate =
  parsed.data.PLATFORM_COMMISSION_RATE === undefined ? 0.175 : parsed.data.PLATFORM_COMMISSION_RATE;

const routeSplitsRaw = process.env.RAZORPAY_ROUTE_SPLITS_ENABLED;
const routeSplitsEnabled = routeSplitsRaw === "true" || routeSplitsRaw === "1";

export const env = {
  ...parsed.data,
  NODE_ENV,
  SUPABASE_JWKS_URL: supabaseJwksUrl,
  RAZORPAY_KEY_ID: razorpayKeyId,
  RAZORPAY_KEY_SECRET: razorpayKeySecret,
  RAZORPAY_WEBHOOK_SECRET: razorpayWebhookSecret,
  PLATFORM_COMMISSION_RATE: platformCommissionRate,
  RAZORPAY_ROUTE_SPLITS_ENABLED: routeSplitsEnabled,
  CORS_ORIGINS: corsOrigins
};
