export type ReconciliationSeverity = "INFO" | "WARNING" | "CRITICAL";

export type ReconciliationIssue = {
  severity: ReconciliationSeverity;
  code: string;
  message: string;
  bookingId?: string;
};

export type ReconciliationReport = {
  generatedAt: string;
  summary: {
    info: number;
    warning: number;
    critical: number;
    bookingsScanned: number;
  };
  issues: ReconciliationIssue[];
};

export function summarizeReconciliation(issues: ReconciliationIssue[], bookingsScanned: number): ReconciliationReport {
  const summary = {
    info: issues.filter((x) => x.severity === "INFO").length,
    warning: issues.filter((x) => x.severity === "WARNING").length,
    critical: issues.filter((x) => x.severity === "CRITICAL").length,
    bookingsScanned
  };
  return { generatedAt: new Date().toISOString(), summary, issues };
}
