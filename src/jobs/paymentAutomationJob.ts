import { logger } from "../config/logger.js";
import { paymentEnv } from "../config/paymentEnv.js";
import { processDueProviderPayouts, retryFailedProviderPayouts } from "../services/payoutAutomationService.js";

type JobState = {
  timer: NodeJS.Timeout | null;
  running: boolean;
  stopped: boolean;
  consecutiveFailures: number;
};

const dueIntervalMs = paymentEnv.PAYMENT_AUTOMATION_PROCESS_DUE_INTERVAL_MS;
const retryIntervalMs = paymentEnv.PAYMENT_AUTOMATION_RETRY_INTERVAL_MS;
const enabled = paymentEnv.PAYMENT_AUTOMATION_ENABLED;

type RuntimeStatus = {
  enabled: boolean;
  runningProcessDue: boolean;
  runningRetry: boolean;
  lastSuccessfulProcessDueAt: string | null;
  lastSuccessfulRetryAt: string | null;
};

const runtimeStatus: RuntimeStatus = {
  enabled,
  runningProcessDue: false,
  runningRetry: false,
  lastSuccessfulProcessDueAt: null,
  lastSuccessfulRetryAt: null
};

function buildJobState(): JobState {
  return { timer: null, running: false, stopped: false, consecutiveFailures: 0 };
}

async function runProtectedJob(
  state: JobState,
  jobName: "process_due" | "retry_failed",
  runner: () => Promise<unknown>,
  baseIntervalMs: number
) {
  if (state.running || state.stopped) return;
  state.running = true;
  if (jobName === "process_due") runtimeStatus.runningProcessDue = true;
  if (jobName === "retry_failed") runtimeStatus.runningRetry = true;
  try {
    const result = await runner();
    state.consecutiveFailures = 0;
    if (jobName === "process_due") runtimeStatus.lastSuccessfulProcessDueAt = new Date().toISOString();
    if (jobName === "retry_failed") runtimeStatus.lastSuccessfulRetryAt = new Date().toISOString();
    logger.info({ jobName, result }, "Payment automation job iteration completed");
  } catch (error) {
    state.consecutiveFailures += 1;
    logger.error({ jobName, error, retryAttempt: state.consecutiveFailures }, "Payment automation job iteration failed");
  } finally {
    state.running = false;
    if (jobName === "process_due") runtimeStatus.runningProcessDue = false;
    if (jobName === "retry_failed") runtimeStatus.runningRetry = false;
    if (!state.stopped) {
      const backoffMs = computeBackoffDelay(baseIntervalMs, state.consecutiveFailures);
      state.timer = setTimeout(() => {
        void runProtectedJob(state, jobName, runner, baseIntervalMs);
      }, backoffMs);
    }
  }
}

export function startPaymentAutomationJob() {
  if (!enabled) {
    logger.info("Payment automation job disabled by environment");
    return {
      stop: () => {}
    };
  }

  const dueState = buildJobState();
  const retryState = buildJobState();

  void runProtectedJob(dueState, "process_due", async () => processDueProviderPayouts(20), dueIntervalMs);
  void runProtectedJob(retryState, "retry_failed", async () => retryFailedProviderPayouts(20), retryIntervalMs);

  logger.info({ dueIntervalMs, retryIntervalMs }, "Payment automation job started");

  return {
    stop: () => {
      dueState.stopped = true;
      retryState.stopped = true;
      if (dueState.timer) clearTimeout(dueState.timer);
      if (retryState.timer) clearTimeout(retryState.timer);
      logger.info("Payment automation job stopped");
    }
  };
}

export function computeBackoffDelay(baseIntervalMs: number, consecutiveFailures: number): number {
  return Math.min(baseIntervalMs * Math.max(1, consecutiveFailures), 10 * baseIntervalMs);
}

export function getPaymentAutomationRuntimeStatus(): RuntimeStatus {
  return { ...runtimeStatus };
}
