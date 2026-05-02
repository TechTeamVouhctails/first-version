import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { httpLogger } from "./config/logger.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { asyncHandler } from "./utils/asyncHandler.js";
import { apiRouter } from "./routes/index.js";
import { handleRazorpayWebhook } from "./routes/payments.webhook.js";

export const app = express();

app.use(httpLogger);
app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGINS,
    credentials: true
  })
);

app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  asyncHandler(handleRazorpayWebhook)
);

app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  return res.status(200).json({ status: "ok", service: "vouchtails-core" });
});

app.use("/api", apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);
