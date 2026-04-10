import type { NextFunction, Request, Response } from "express";
import pino from "pino";
import { env } from "./env.js";

export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",
      "body.signature"
    ],
    censor: "[REDACTED]"
  }
});

export function httpLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const requestId = req.headers["x-request-id"]?.toString() ?? crypto.randomUUID();
  const child = logger.child({ requestId });
  (req as Request & { log: typeof child }).log = child;
  res.on("finish", () => {
    child.info(
      {
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Date.now() - start
      },
      "HTTP request completed"
    );
  });
  next();
}
