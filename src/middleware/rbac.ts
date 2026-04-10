import type { Role } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { AppError } from "../utils/errors.js";

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      return next(new AppError("Unauthorized", StatusCodes.UNAUTHORIZED, "UNAUTHORIZED"));
    }

    if (!req.auth.role || !roles.includes(req.auth.role)) {
      return next(new AppError("Forbidden", StatusCodes.FORBIDDEN, "FORBIDDEN"));
    }
    return next();
  };
}
