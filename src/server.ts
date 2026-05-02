import { createServer } from "http";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { prisma } from "./config/prisma.js";
import { app } from "./app.js";
import { initSocket } from "./realtime/socket.js";

const server = createServer(app);
initSocket(server);

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
