import { describe, expect, it } from "vitest";
import { summarizeReconciliation } from "../src/lib/payments/reconciliationReport.js";

describe("global reconciliation report", () => {
  it("summarizes severity counts", () => {
    const report = summarizeReconciliation(
      [
        { severity: "INFO", code: "i1", message: "info" },
        { severity: "WARNING", code: "w1", message: "warn" },
        { severity: "CRITICAL", code: "c1", message: "critical" }
      ],
      7
    );
    expect(report.summary.info).toBe(1);
    expect(report.summary.warning).toBe(1);
    expect(report.summary.critical).toBe(1);
    expect(report.summary.bookingsScanned).toBe(7);
  });
});
