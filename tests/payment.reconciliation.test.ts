import { describe, expect, it } from "vitest";
import { computeBookingPaymentConsistency } from "../src/lib/payments/reconciliation.js";

describe("payment reconciliation helpers", () => {
  it("detects missing escrow and duplicate order ids", () => {
    const issues = computeBookingPaymentConsistency({
      payments: [
        { id: "t1", stage: "DEPOSIT", status: "CAPTURED", orderId: "order_1", paymentId: "pay_1" },
        { id: "t2", stage: "FINAL", status: "CAPTURED", orderId: "order_1", paymentId: null }
      ],
      escrowRows: [{ paymentTransactionId: "t1" }]
    });

    expect(issues).toContain("missing_escrow_for_final");
    expect(issues).toContain("captured_without_payment_id_final");
    expect(issues).toContain("duplicate_order_id_order_1");
  });
});
