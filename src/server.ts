import { createServer } from "http";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { prisma } from "./config/prisma.js";
import { app } from "./app.js";
import { initSocket } from "./realtime/socket.js";

const server = createServer(app);
initSocket(server);

async function bootstrap() {
  await prisma.$connect();
  server.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "VouchTails backend started");
  });
}

bootstrap().catch((err) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
});
