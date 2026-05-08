/**
 * Platform commission on the captured gross (default 17.5% pilot).
 * Remainder stays on the Razorpay merchant balance or is routed via `transfers` when Route splits are enabled.
 */
export function splitGrossCommissionPaise(
  grossAmountPaise: number,
  commissionRate: number
): { platformFeePaise: number; providerSharePaise: number } {
  if (!Number.isFinite(grossAmountPaise) || grossAmountPaise < 0) {
    throw new Error("grossAmountPaise must be a non-negative finite number");
  }
  if (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 1) {
    throw new Error("commissionRate must be between 0 and 1");
  }
  const platformFeePaise = Math.round(grossAmountPaise * commissionRate);
  const providerSharePaise = grossAmountPaise - platformFeePaise;
  return { platformFeePaise, providerSharePaise };
}
