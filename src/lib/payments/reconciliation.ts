type PaymentLike = {
  id: string;
  stage: "DEPOSIT" | "FINAL" | "PAYOUT";
  status: "CREATED" | "AUTHORIZED" | "CAPTURED" | "FAILED" | "REFUNDED";
  orderId: string | null;
  paymentId: string | null;
};

type EscrowLike = {
  paymentTransactionId: string;
};

type BookingPaymentConsistencyInput = {
  payments: PaymentLike[];
  escrowRows: EscrowLike[];
};

export function computeBookingPaymentConsistency(input: BookingPaymentConsistencyInput): string[] {
  const issues: string[] = [];
  const escrowTxIds = new Set(input.escrowRows.map((row) => row.paymentTransactionId));

  for (const payment of input.payments) {
    if (payment.status === "CAPTURED" && payment.stage !== "PAYOUT") {
      if (!escrowTxIds.has(payment.id)) {
        issues.push(`missing_escrow_for_${payment.stage.toLowerCase()}`);
      }
      if (!payment.paymentId) {
        issues.push(`captured_without_payment_id_${payment.stage.toLowerCase()}`);
      }
    }
  }

  const staged = input.payments.filter((p) => p.stage === "DEPOSIT" || p.stage === "FINAL");
  const byOrderId = new Map<string, number>();
  for (const payment of staged) {
    if (!payment.orderId) continue;
    byOrderId.set(payment.orderId, (byOrderId.get(payment.orderId) ?? 0) + 1);
  }
  for (const [orderId, count] of byOrderId.entries()) {
    if (count > 1) issues.push(`duplicate_order_id_${orderId}`);
  }

  return Array.from(new Set(issues));
}
