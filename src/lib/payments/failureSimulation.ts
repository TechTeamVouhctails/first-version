import { paymentEnv } from "../../config/paymentEnv.js";
import { prisma } from "../../config/prisma.js";
import { processWebhook } from "../../services/paymentService.js";
import { runGlobalPaymentReconciliation } from "../../services/payoutAutomationService.js";
import { withPgAdvisoryLock } from "../../utils/locking.js";

function assertSimulationsAllowed(nodeEnv: string) {
  if (nodeEnv === "production" || !paymentEnv.PAYMENT_FAIL_SIMULATION_ENABLED) {
    throw new Error("Failure simulation utilities are disabled");
  }
}

export async function simulateWebhookReplayStorm(nodeEnv: string, dedupeKey: string, eventType: string, payload: unknown, attempts = 10) {
  assertSimulationsAllowed(nodeEnv);
  const runs = Array.from({ length: attempts }, (_, idx) =>
    processWebhook(`${dedupeKey}:storm:${idx}`, eventType, payload).catch((error: unknown) => ({
      error: error instanceof Error ? error.message : "unknown_error"
    }))
  );
  return Promise.all(runs);
}

export async function simulateForcedPayoutFailure(nodeEnv: string, bookingId: string) {
  assertSimulationsAllowed(nodeEnv);
  await prisma.providerPayout.update({
    where: { bookingId },
    data: { status: "RETRYABLE_FAILED", notes: "Simulated failure" }
  });
  return { ok: true };
}

export async function simulateReconciliationMismatch(nodeEnv: string) {
  assertSimulationsAllowed(nodeEnv);
  return runGlobalPaymentReconciliation(50);
}

export async function simulateStaleLock(nodeEnv: string, key: string, holdMs = 3000) {
  assertSimulationsAllowed(nodeEnv);
  const result = await withPgAdvisoryLock(`sim:${key}`, async () => {
    await new Promise((resolve) => setTimeout(resolve, holdMs));
    return { held: true, holdMs };
  });
  return result;
}
