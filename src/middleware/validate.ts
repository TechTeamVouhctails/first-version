import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";
import { AppError } from "../utils/errors.js";

export function validate(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse({
      params: req.params,
      query: req.query,
      body: req.body
    });

    if (!parsed.success) {
      return next(new AppError("Validation failed", 422, "VALIDATION_ERROR", parsed.error.flatten()));
    }

    req.params = parsed.data.params ?? req.params;
    req.query = parsed.data.query ?? req.query;
    req.body = parsed.data.body ?? req.body;
    return next();
  };
}
