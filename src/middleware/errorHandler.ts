import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { StatusCodes } from "http-status-codes";
import { ZodError } from "zod";
import { logger } from "../config/logger.js";
import { AppError } from "../utils/errors.js";

export function notFoundHandler(_req: Request, res: Response) {
  return res.status(StatusCodes.NOT_FOUND).json({
    code: "NOT_FOUND",
    message: "Route not found"
  });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    req.log.warn({ err, code: err.code }, "Application error");
    return res.status(err.statusCode).json({
      code: err.code,
      message: err.message,
      details: err.details
    });
  }

  if (err instanceof ZodError) {
    return res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      details: err.flatten()
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      code: "DATABASE_ERROR",
      message: "Database request failed",
      details: { code: err.code, meta: err.meta }
    });
  }

  logger.error({ err }, "Unhandled error");
  return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    code: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred"
  });
}
