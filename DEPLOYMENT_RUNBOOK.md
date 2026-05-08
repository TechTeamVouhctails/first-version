# VouchTails Payment Deployment Runbook

## Deployment Checklist
- Apply Prisma migrations before starting app instances.
- Verify payment env vars (`RAZORPAY_*`, `INTERNAL_PAYOUT_TOKEN`, payment toggle vars).
- Confirm webhook URL and secret match deployed environment.
- Start backend and verify startup diagnostics log shows DB + advisory lock + scheduler status.
- Call `GET /api/payments/internal/health` with internal token and validate all counters.

## Migration Order
1. `prisma migrate deploy`
2. `npm run prisma:generate`
3. Deploy app release
4. Smoke test payment internal health and reconcile endpoints

## Rollback Steps
1. Set `PAYMENT_AUTOMATION_ENABLED=false`
2. Set `PAYMENT_TRANSFER_EXECUTION_ENABLED=false`
3. Optionally set `PAYMENT_WEBHOOK_PAUSED=true` for emergency containment
4. Roll app back to previous release
5. Run `GET /api/payments/internal/reconcile` and inspect issues before re-enabling automation

## Webhook Setup Checklist
- Razorpay event: `payment.captured`
- Endpoint: `POST /api/payments/webhook`
- Raw JSON delivery enabled
- Secret configured as `RAZORPAY_WEBHOOK_SECRET`
- Retry policy left enabled in Razorpay dashboard

## Sandbox to Production Switch
- Replace test key id/secret/webhook secret with live credentials.
- Verify provider `routeLinkedAccountId` onboarding status.
- Keep `PAYMENT_PAYOUT_DRY_RUN=true` for first smoke window.
- After reconciliation clean status, set `PAYMENT_PAYOUT_DRY_RUN=false`.

## Payout Automation Enable Checklist
- `PAYMENT_AUTOMATION_ENABLED=true`
- `PAYMENT_TRANSFER_EXECUTION_ENABLED=true`
- sane intervals for process/retry loops
- confirm health endpoint reflects scheduler enabled and recent run timestamps

## Emergency Disable Procedure
- Immediately set:
  - `PAYMENT_AUTOMATION_ENABLED=false`
  - `PAYMENT_TRANSFER_EXECUTION_ENABLED=false`
  - `PAYMENT_WEBHOOK_PAUSED=true` (only for severe incidents)
- Use internal recovery endpoints to repair stuck payouts/bookings.
- Export reconciliation report and triage CRITICAL issues first.
