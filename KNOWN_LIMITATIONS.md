# Known Limitations

## Sandbox / Razorpay Constraints
- Route transfer success in sandbox may differ from production behavior.
- Provider Route onboarding (`routeLinkedAccountId`) may be incomplete; manual fallback is expected.
- Webhook retries are externally managed and can arrive out-of-order.

## Operational Constraints
- Automation runner is process-local (intentionally lightweight); reliability depends on service uptime.
- Advisory locking prevents duplicate side effects, but long DB outages still require manual recovery.
- Webhook pause toggle is a hard stop; prolonged use can delay state convergence.

## Current Business Constraints
- Live payout automation depends on Razorpay business/CIN readiness.
- Manual payout paths still required for providers without linked Route accounts.

## Monitoring Gaps (Accepted for Now)
- No external APM/metrics backend integrated yet.
- Audit log + health endpoints are the primary observability surfaces.
