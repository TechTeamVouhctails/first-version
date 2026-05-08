import { describe, expect, it } from "vitest";
import { exportReconciliation } from "../src/lib/payments/reconciliationExport.js";

describe("reconciliation export", () => {
  const report = {
    generatedAt: new Date().toISOString(),
    summary: { info: 0, warning: 1, critical: 0, bookingsScanned: 1 },
    issues: [{ severity: "WARNING" as const, code: "sample", message: "sample issue", bookingId: "b1" }]
  };

  it("exports json", () => {
    const out = exportReconciliation(report, "json");
    expect(out.contentType).toBe("application/json");
    expect(out.payload).toContain("\"issues\"");
  });

  it("exports csv", () => {
    const out = exportReconciliation(report, "csv");
    expect(out.contentType).toBe("text/csv");
    expect(out.payload).toContain("severity,code,message,bookingId");
  });
});
