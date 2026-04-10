import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../config/prisma.js";
import { verifySupabaseJwt } from "../config/supabase.js";
import { AppError } from "../utils/errors.js";

export async function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AppError("Missing bearer token", StatusCodes.UNAUTHORIZED, "UNAUTHORIZED");
    }

    const token = authHeader.slice(7);
    const payload = await verifySupabaseJwt(token);
    const supabaseUserId = payload.sub;

    if (!supabaseUserId) {
      throw new AppError("Invalid JWT payload", StatusCodes.UNAUTHORIZED, "INVALID_TOKEN");
    }

    const updateData: { phone?: string; email?: string } = {};
    if (typeof payload.phone === "string") updateData.phone = payload.phone;
    if (typeof payload.email === "string") updateData.email = payload.email;

    const createData: { supabaseUserId: string; phone?: string; email?: string } = { supabaseUserId };
    if (typeof payload.phone === "string") createData.phone = payload.phone;
    if (typeof payload.email === "string") createData.email = payload.email;

    const user = await prisma.user.upsert({
      where: { supabaseUserId },
      update: updateData,
      create: createData
    });

    req.auth = {
      supabaseUserId,
      userId: user.id,
      role: user.role
    };

    return next();
  } catch (error) {
    return next(error);
  }
}
