# VouchTails Payment Sandbox Testing Guide

## Prerequisites
- Razorpay test keys configured in backend `.env`.
- `RAZORPAY_WEBHOOK_SECRET` set from Razorpay sandbox webhook config.
- Backend running with migrations applied.
- Test users available for owner + provider roles.

## Required Env Flags (Suggested for First Internal Sandbox Run)
- `PAYMENT_AUTOMATION_ENABLED=true`
- `PAYMENT_TRANSFER_EXECUTION_ENABLED=true`
- `PAYMENT_PAYOUT_DRY_RUN=true` (start safe)
- `PAYMENT_WEBHOOK_PAUSED=false`
- `PAYMENT_FAIL_SIMULATION_ENABLED=true` (staging only)

## End-to-End Booking + Payment Flow Validation
1. Create booking -> verify `REQUESTED`.
2. Provider confirms -> `CONFIRMED`.
3. Pay deposit via `POST /api/payments/create-order` + `POST /api/payments/verify-payment`.
4. Verify `depositPaidAt` is set and deposit transaction is `CAPTURED`.
5. Start/end OTP flow -> `PENDING_PAYMENT`.
6. Pay final -> ensure transition chain:
   - `PENDING_PAYMENT -> PAYMENT_LOCKED -> COMPLETED -> PAYOUT_PENDING`
7. Verify:
   - final transaction `CAPTURED`
   - escrow rows exist for deposit and final
   - provider payout row exists with `READY_AFTER_DISPUTE_WINDOW`
8. Move eligible window (test DB/manual) and run payout processor:
   - `POST /api/payments/internal/payouts/process-due`
9. Verify payout behavior:
   - with dry-run: no transfer executed, audit log indicates dry-run
   - with dry-run false + route setup: payout released path completes

## Webhook Validation
- Endpoint: `POST /api/payments/webhook`
- Must send raw JSON body with `x-razorpay-signature`.
- Expected event: `payment.captured`.
- Duplicate delivery should return idempotent result.

## Suggested Sandbox API Examples
- Create order:
  - `POST /api/payments/create-order`
  - body: `{ "bookingId": "<cuid>", "stage": "DEPOSIT" }`
  - header: `x-idempotency-key: <uuid>`
- Verify payment:
  - `POST /api/payments/verify-payment`
  - body: `{ "bookingId":"<cuid>","orderId":"order_x","paymentId":"pay_x","signature":"...","stage":"DEPOSIT" }`
- Health:
  - `GET /api/payments/internal/health` with `x-internal-payout-token`

## Sandbox Limitations to Expect
- Route transfer behavior can vary in test mode depending on account permissions.
- Some webhook retries may have delivery delay.
- Route linked accounts may be absent for test providers -> manual fallback is expected.
