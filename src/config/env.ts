import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(8080),
  DATABASE_URL: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_JWKS_URL: z.string().url(),
  RAZORPAY_KEY_ID: z.string().min(1),
  RAZORPAY_KEY_SECRET: z.string().min(1),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1),
  INTERNAL_PAYOUT_TOKEN: z.string().min(1),
  CORS_ORIGIN: z.string().default("http://localhost:3000")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables");
}

const dbUrl = parsed.data.DATABASE_URL;
if (dbUrl.includes("[PASSWORD]") || dbUrl.includes("[SUPABASE_REF]") || dbUrl.includes("<URL_ENCODED_DB_PASSWORD>")) {
  throw new Error(
    "DATABASE_URL contains placeholder values. Set a real Supabase Postgres URL and URL-encode the password."
  );
}

export const env = parsed.data;
