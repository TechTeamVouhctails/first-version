import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../config/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { criticalActionRateLimiter } from "../middleware/rateLimit.js";
import { softLockMiddleware } from "../middleware/softLock.js";
import { validate } from "../middleware/validate.js";
import { listMessagesSchema, sendMessageSchema } from "../schemas/chat.schema.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/errors.js";

export const chatRouter = Router();

chatRouter.use(authMiddleware);

chatRouter.post(
  "/messages",
  softLockMiddleware,
  criticalActionRateLimiter,
  validate(sendMessageSchema),
  asyncHandler(async (req, res) => {
    const { bookingId, receiverId, body } = req.body as {
      bookingId: string;
      receiverId: string;
      body: string;
    };

    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    if (![booking.ownerId, booking.providerId].includes(req.auth!.userId)) {
      throw new AppError("Only booking participants can chat", StatusCodes.FORBIDDEN, "FORBIDDEN");
    }
    if (![booking.ownerId, booking.providerId].includes(receiverId)) {
      throw new AppError("Receiver must be booking participant", StatusCodes.BAD_REQUEST, "INVALID_RECEIVER");
    }

    const message = await prisma.chatMessage.create({
      data: {
        bookingId,
        senderId: req.auth!.userId,
        receiverId,
        body
      }
    });
    return res.status(StatusCodes.CREATED).json({ message });
  })
);

chatRouter.get(
  "/messages",
  validate(listMessagesSchema),
  asyncHandler(async (req, res) => {
    const { bookingId, limit, cursor } = req.query as unknown as {
      bookingId: string;
      limit: number;
      cursor?: string;
    };

    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    if (![booking.ownerId, booking.providerId].includes(req.auth!.userId)) {
      throw new AppError("Forbidden", StatusCodes.FORBIDDEN, "FORBIDDEN");
    }

    const messages = await prisma.chatMessage.findMany({
      where: { bookingId },
      orderBy: { createdAt: "desc" },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {})
    });
    return res.status(StatusCodes.OK).json({ messages });
  })
);
