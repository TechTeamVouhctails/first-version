import { Router } from "express";
import { authRouter } from "./auth.routes.js";
import { bookingsRouter } from "./bookings.routes.js";
import { chatRouter } from "./chat.routes.js";
import { paymentsRouter } from "./payments.routes.js";
import { petsRouter } from "./pets.routes.js";
import { providersRouter } from "./providers.routes.js";
import { usersRouter } from "./users.routes.js";

export const apiRouter = Router();

apiRouter.get("/", (_req, res) => {
  return res.status(200).json({
    service: "vouchtails-core",
    message: "API root — use nested paths (this is not a collection endpoint).",
    health: "/health",
    routes: [
      "POST /api/auth/send-otp",
      "POST /api/auth/verify-otp",
      "POST /api/auth/set-role",
      "GET  /api/users/me",
      "GET  /api/pets",
      "POST /api/pets",
      "GET  /api/providers/me",
      "GET  /api/providers/nearby",
      "GET  /api/providers/match",
      "GET  /api/bookings",
      "POST /api/bookings",
      "POST /api/payments/create-order",
      "POST /api/payments/verify-payment",
      "POST /api/payments/verify",
      "GET  /api/payments/:bookingId/status",
      "POST /api/payments/internal/payouts/process-due",
      "POST /api/payments/internal/payouts/retry-failed",
      "GET  /api/payments/internal/health",
      "GET  /api/payments/internal/reconcile/:bookingId",
      "GET  /api/payments/internal/reconcile",
      "GET  /api/payments/internal/reconcile/export",
      "POST /api/payments/internal/webhook/replay",
      "POST /api/payments/internal/payouts/:bookingId/mark-released",
      "POST /api/payments/internal/payouts/:bookingId/set-status",
      "POST /api/payments/internal/bookings/:bookingId/repair-state",
      "POST /api/payments/internal/failure-simulate",
      "POST /api/payments/webhook (Razorpay; raw JSON body)"
    ]
  });
});

apiRouter.use("/auth", authRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/pets", petsRouter);
apiRouter.use("/providers", providersRouter);
apiRouter.use("/bookings", bookingsRouter);
apiRouter.use("/chat", chatRouter);
apiRouter.use("/payments", paymentsRouter);
