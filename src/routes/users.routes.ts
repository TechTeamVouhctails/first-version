import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../config/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { updateProfileSchema } from "../schemas/user.schema.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const usersRouter = Router();

usersRouter.use(authMiddleware);

usersRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.auth!.userId },
      include: { providerProfile: true }
    });
    return res.status(StatusCodes.OK).json({ user });
  })
);

usersRouter.patch(
  "/me",
  validate(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as { name?: string; email?: string; city?: "Chennai" };
    const user = await prisma.user.update({
      where: { id: req.auth!.userId },
      data: body
    });
    return res.status(StatusCodes.OK).json({ user });
  })
);
