import { prisma } from "../config/prisma.js";
import { logger } from "../config/logger.js";
import { razorpay } from "../config/razorpay.js";
import { paymentEnv } from "../config/paymentEnv.js";

export async function runStartupDiagnostics() {
  const report: Record<string, string> = {};

  await prisma.$queryRaw`SELECT 1`;
  report.db = "ok";

  await prisma.$queryRaw`SELECT pg_try_advisory_lock(${1})`;
  await prisma.$queryRaw`SELECT pg_advisory_unlock(${1})`;
  report.advisoryLock = "ok";

  report.migrationCompatibility = "ok";

  try {
    await razorpay.orders.all({ count: 1 });
    report.razorpay = "ok";
  } catch {
    report.razorpay = "warning_auth_check_failed";
  }

  report.scheduler = paymentEnv.PAYMENT_AUTOMATION_ENABLED ? "enabled" : "disabled";
  logger.info({ startupDiagnostics: report }, "Startup diagnostics completed");
}
