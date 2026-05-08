import type { ReconciliationReport } from "./reconciliationReport.js";

export function toReconciliationCsv(report: ReconciliationReport): string {
  const header = "severity,code,message,bookingId";
  const rows = report.issues.map((issue) =>
    [issue.severity, issue.code, issue.message.replace(/,/g, ";"), issue.bookingId ?? ""].join(",")
  );
  return [header, ...rows].join("\n");
}

export function exportReconciliation(report: ReconciliationReport, format: "json" | "csv") {
  if (format === "csv") {
    return { contentType: "text/csv", payload: toReconciliationCsv(report) };
  }
  return { contentType: "application/json", payload: JSON.stringify(report, null, 2) };
}
