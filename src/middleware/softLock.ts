import type { NextFunction, Request, Response } from "express";
import { BookingState } from "@prisma/client";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/errors.js";

export async function softLockMiddleware(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) {
    return next(new AppError("Unauthorized", StatusCodes.UNAUTHORIZED, "UNAUTHORIZED"));
  }

  const pending = await prisma.booking.findFirst({
    where: {
      OR: [{ ownerId: req.auth.userId }, { providerId: req.auth.userId }],
      state: { in: [BookingState.PENDING_PAYMENT, BookingState.PAYMENT_LOCKED] }
    },
    select: { id: true }
  });

  if (pending) {
    return next(new AppError("Action blocked until pending payment is completed", 423, "SOFT_LOCKED"));
  }
  return next();
}
