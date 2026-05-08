# Payment Operations Guide

## Internal Endpoints (Token Required)
All endpoints below require `x-internal-payout-token`.

- Health summary:
  - `GET /api/payments/internal/health`
- Process due payouts:
  - `POST /api/payments/internal/payouts/process-due`
- Retry failed payouts:
  - `POST /api/payments/internal/payouts/retry-failed`
- Reconcile single booking:
  - `GET /api/payments/internal/reconcile/:bookingId`
- Reconcile global:
  - `GET /api/payments/internal/reconcile?limit=200`
- Export reconciliation:
  - `GET /api/payments/internal/reconcile/export?format=json|csv&limit=200`

## Recovery Endpoints
- Replay webhook:
  - `POST /api/payments/internal/webhook/replay`
  - body: `{ "dedupeKey": "<existing_webhook_dedupe_key>" }`
- Mark payout released:
  - `POST /api/payments/internal/payouts/:bookingId/mark-released`
- Override payout status:
  - `POST /api/payments/internal/payouts/:bookingId/set-status`
  - body: `{ "status": "RETRYABLE_FAILED" | "READY_AFTER_DISPUTE_WINDOW" }`
- Repair booking-payment state:
  - `POST /api/payments/internal/bookings/:bookingId/repair-state`

## Safe Toggle Procedures
- Pause automation:
  - `PAYMENT_AUTOMATION_ENABLED=false`
- Stop transfer execution:
  - `PAYMENT_TRANSFER_EXECUTION_ENABLED=false`
- Keep scheduler live but non-executing:
  - `PAYMENT_PAYOUT_DRY_RUN=true`
- Pause webhook processing (emergency only):
  - `PAYMENT_WEBHOOK_PAUSED=true`

## Failure Simulation (Non-Production Only)
- Endpoint:
  - `POST /api/payments/internal/failure-simulate`
- Types:
  - `webhook_storm`
  - `payout_failure`
  - `reconciliation_mismatch`
  - `stale_lock`

## What to Monitor
- `PaymentAuditLog`:
  - `WEBHOOK_PROCESSING_FAILED`
  - `PAYOUT_RETRYABLE_FAILED`
  - `PAYOUT_BLOCKED_BY_TOGGLE`
  - `GLOBAL_RECONCILIATION_ISSUE`
- Health endpoint counters for:
  - failed payouts
  - stale processing payouts
  - stuck `PAYMENT_LOCKED` bookings
  - webhook failures
