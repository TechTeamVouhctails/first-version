import { createServer } from "http";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { paymentEnv } from "./config/paymentEnv.js";
import { prisma } from "./config/prisma.js";
import { app } from "./app.js";
import { startPaymentAutomationJob } from "./jobs/paymentAutomationJob.js";
import { initSocket } from "./realtime/socket.js";
import { runStartupDiagnostics } from "./services/startupDiagnosticsService.js";

const server = createServer(app);
initSocket(server);
let paymentJob: ReturnType<typeof startPaymentAutomationJob> | null = null;

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    logger.error(
      { port: env.PORT },
      "Port already in use — stop the other Node process (old `npm run dev`) or change PORT in .env"
    );
  } else {
    logger.error({ err }, "HTTP server error");
  }
  process.exit(1);
});

async function bootstrap() {
  await prisma.$connect();
  await runStartupDiagnostics();
  paymentJob = startPaymentAutomationJob();
  server.listen(env.PORT, () => {
    logger.info(
      {
        port: env.PORT,
        paymentFlags: {
          automationEnabled: paymentEnv.PAYMENT_AUTOMATION_ENABLED,
          transferExecutionEnabled: paymentEnv.PAYMENT_TRANSFER_EXECUTION_ENABLED,
          payoutDryRun: paymentEnv.PAYMENT_PAYOUT_DRY_RUN,
          webhookPaused: paymentEnv.PAYMENT_WEBHOOK_PAUSED
        }
      },
      "VouchTails backend started"
    );
  });
}

bootstrap().catch((err) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});

process.on("SIGTERM", async () => {
  paymentJob?.stop();
  await prisma.$disconnect();
  server.close(() => process.exit(0));
});
