export const payoutStatuses = {
  READY_AFTER_DISPUTE_WINDOW: "READY_AFTER_DISPUTE_WINDOW",
  PROCESSING: "PROCESSING",
  RELEASED: "RELEASED",
  MANUAL_PENDING: "MANUAL_PENDING",
  RETRYABLE_FAILED: "RETRYABLE_FAILED"
} as const;

export type PayoutStatus = (typeof payoutStatuses)[keyof typeof payoutStatuses];

export function isDueForPayout(status: string, eligibleAt: Date, now: Date): boolean {
  return status === payoutStatuses.READY_AFTER_DISPUTE_WINDOW && eligibleAt <= now;
}

export function canAttemptAutomatedRouteTransfer(
  routeEnabled: boolean,
  linkedAccountId: string | null | undefined
): boolean {
  return routeEnabled && !!linkedAccountId && linkedAccountId.trim().length > 3;
}
