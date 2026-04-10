import { BookingState, Prisma } from "@prisma/client";
import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../config/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { criticalActionRateLimiter } from "../middleware/rateLimit.js";
import { requireRole } from "../middleware/rbac.js";
import { softLockMiddleware } from "../middleware/softLock.js";
import { validate } from "../middleware/validate.js";
import {
  bookingIdSchema,
  cancelBookingSchema,
  createBookingSchema,
  otpSubmitSchema,
  sessionTrackSchema
} from "../schemas/booking.schema.js";
import { splitAmounts, transitionBookingState } from "../services/bookingService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sha256 } from "../utils/crypto.js";
import { AppError } from "../utils/errors.js";

export const bookingsRouter = Router();

bookingsRouter.use(authMiddleware);

bookingsRouter.post(
  "/",
  requireRole("PET_PARENT"),
  softLockMiddleware,
  validate(createBookingSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as {
      providerId: string;
      petId: string;
      serviceType: "WALKING" | "SITTING" | "GROOMING" | "BOARDING";
      address: string;
      latitude: number;
      longitude: number;
      startsAt: Date;
      endsAt: Date;
      estimatedAmount: number;
    };

    if (body.endsAt <= body.startsAt) {
      throw new AppError("End time must be after start time", 422, "INVALID_TIME_RANGE");
    }
    const { deposit, final } = splitAmounts(body.estimatedAmount);
    const booking = await prisma.booking.create({
      data: {
        ownerId: req.auth!.userId,
        providerId: body.providerId,
        petId: body.petId,
        serviceType: body.serviceType,
        address: body.address,
        city: "Chennai",
        latitude: new Prisma.Decimal(body.latitude),
        longitude: new Prisma.Decimal(body.longitude),
        startsAt: body.startsAt,
        endsAt: body.endsAt,
        estimatedAmount: new Prisma.Decimal(body.estimatedAmount),
        depositAmount: deposit,
        finalAmount: final,
        state: BookingState.REQUESTED
      }
    });

    return res.status(StatusCodes.CREATED).json({ booking });
  })
);

bookingsRouter.post(
  "/:bookingId/confirm",
  requireRole("PROVIDER"),
  validate(bookingIdSchema),
  asyncHandler(async (req, res) => {
    const { bookingId } = req.params as { bookingId: string };
    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });

    if (booking.providerId !== req.auth!.userId) {
      throw new AppError("Only assigned provider can confirm booking", StatusCodes.FORBIDDEN, "FORBIDDEN");
    }

    const updated = await transitionBookingState(prisma, bookingId, req.auth!.userId, BookingState.CONFIRMED, "Provider confirmed");
    return res.status(StatusCodes.OK).json({ booking: updated });
  })
);

bookingsRouter.post(
  "/:bookingId/cancel",
  validate(cancelBookingSchema),
  asyncHandler(async (req, res) => {
    const { bookingId } = req.params as { bookingId: string };
    const { reason } = req.body as { reason?: string };
    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });

    let nextState: BookingState;
    if (booking.ownerId === req.auth!.userId) {
      nextState = BookingState.CANCELLED_BY_OWNER;
    } else if (booking.providerId === req.auth!.userId) {
      nextState = BookingState.CANCELLED_BY_PROVIDER;
    } else {
      throw new AppError("Only booking parties can cancel", StatusCodes.FORBIDDEN, "FORBIDDEN");
    }

    const updated = await transitionBookingState(prisma, bookingId, req.auth!.userId, nextState, reason);
    return res.status(StatusCodes.OK).json({ booking: updated });
  })
);

bookingsRouter.post(
  "/:bookingId/otp/start",
  requireRole("PROVIDER"),
  criticalActionRateLimiter,
  validate(bookingIdSchema),
  asyncHandler(async (req, res) => {
    const { bookingId } = req.params as { bookingId: string };
    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    if (booking.providerId !== req.auth!.userId) {
      throw new AppError("Only provider can prepare start OTP", StatusCodes.FORBIDDEN, "FORBIDDEN");
    }
    const otp = `${Math.floor(100000 + Math.random() * 900000)}`;
    const updated = await prisma.$transaction(async (tx) => {
      const changed = await transitionBookingState(tx, bookingId, req.auth!.userId, BookingState.OTP_READY, "Start OTP generated");
      await tx.booking.update({
        where: { id: bookingId },
        data: { otpStartHash: sha256(otp) }
      });
      return changed;
    });
    return res.status(StatusCodes.OK).json({
      booking: updated,
      otp
    });
  })
);

bookingsRouter.post(
  "/:bookingId/start-session",
  requireRole("PET_PARENT"),
  criticalActionRateLimiter,
  validate(otpSubmitSchema),
  asyncHandler(async (req, res) => {
    const { bookingId } = req.params as { bookingId: string };
    const { otp } = req.body as { otp: string };
    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });

    if (booking.ownerId !== req.auth!.userId) {
      throw new AppError("Only owner can verify start OTP", StatusCodes.FORBIDDEN, "FORBIDDEN");
    }
    if (!booking.otpStartHash || sha256(otp) !== booking.otpStartHash) {
      throw new AppError("Invalid OTP", StatusCodes.BAD_REQUEST, "INVALID_OTP");
    }
    const updated = await transitionBookingState(prisma, bookingId, req.auth!.userId, BookingState.IN_PROGRESS, "Start OTP verified");
    return res.status(StatusCodes.OK).json({ booking: updated });
  })
);

bookingsRouter.post(
  "/:bookingId/otp/end",
  requireRole("PROVIDER"),
  criticalActionRateLimiter,
  validate(bookingIdSchema),
  asyncHandler(async (req, res) => {
    const { bookingId } = req.params as { bookingId: string };
    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    if (booking.providerId !== req.auth!.userId) {
      throw new AppError("Only provider can request end OTP", StatusCodes.FORBIDDEN, "FORBIDDEN");
    }

    const otp = `${Math.floor(100000 + Math.random() * 900000)}`;
    const updated = await prisma.$transaction(async (tx) => {
      const changed = await transitionBookingState(tx, bookingId, req.auth!.userId, BookingState.PENDING_END_OTP, "End OTP generated");
      await tx.booking.update({
        where: { id: bookingId },
        data: { otpEndHash: sha256(otp) }
      });
      return changed;
    });
    return res.status(StatusCodes.OK).json({ booking: updated, otp });
  })
);

bookingsRouter.post(
  "/:bookingId/end-session",
  requireRole("PET_PARENT"),
  criticalActionRateLimiter,
  validate(otpSubmitSchema),
  asyncHandler(async (req, res) => {
    const { bookingId } = req.params as { bookingId: string };
    const { otp } = req.body as { otp: string };
    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    if (booking.ownerId !== req.auth!.userId) {
      throw new AppError("Only owner can verify end OTP", StatusCodes.FORBIDDEN, "FORBIDDEN");
    }
    if (!booking.otpEndHash || sha256(otp) !== booking.otpEndHash) {
      throw new AppError("Invalid OTP", StatusCodes.BAD_REQUEST, "INVALID_OTP");
    }

    const updated = await transitionBookingState(prisma, bookingId, req.auth!.userId, BookingState.PENDING_PAYMENT, "End OTP verified");
    return res.status(StatusCodes.OK).json({ booking: updated });
  })
);

bookingsRouter.post(
  "/:bookingId/session-tracking",
  requireRole("PROVIDER"),
  validate(sessionTrackSchema),
  asyncHandler(async (req, res) => {
    const { bookingId } = req.params as { bookingId: string };
    const body = req.body as {
      latitude: number;
      longitude: number;
      speedKmph?: number;
      accuracyM?: number;
      batteryPct?: number;
    };
    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    if (booking.providerId !== req.auth!.userId) {
      throw new AppError("Only provider can publish tracking", StatusCodes.FORBIDDEN, "FORBIDDEN");
    }
    if (booking.state !== BookingState.IN_PROGRESS) {
      throw new AppError("Tracking allowed only during in-progress sessions", 409, "INVALID_TRACKING_STATE");
    }
    const row = await prisma.sessionTracking.create({
      data: {
        bookingId,
        providerId: req.auth!.userId,
        latitude: new Prisma.Decimal(body.latitude),
        longitude: new Prisma.Decimal(body.longitude),
        ...(typeof body.speedKmph === "number" ? { speedKmph: new Prisma.Decimal(body.speedKmph) } : {}),
        ...(typeof body.accuracyM === "number" ? { accuracyM: new Prisma.Decimal(body.accuracyM) } : {}),
        ...(typeof body.batteryPct === "number" ? { batteryPct: body.batteryPct } : {})
      }
    });
    return res.status(StatusCodes.CREATED).json({ sessionTracking: row });
  })
);

bookingsRouter.get(
  "/:bookingId/session-tracking",
  validate(bookingIdSchema),
  asyncHandler(async (req, res) => {
    const { bookingId } = req.params as { bookingId: string };
    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    if (![booking.ownerId, booking.providerId].includes(req.auth!.userId)) {
      throw new AppError("Forbidden", StatusCodes.FORBIDDEN, "FORBIDDEN");
    }
    const points = await prisma.sessionTracking.findMany({
      where: { bookingId },
      orderBy: { recordedAt: "asc" }
    });
    return res.status(StatusCodes.OK).json({ points });
  })
);
