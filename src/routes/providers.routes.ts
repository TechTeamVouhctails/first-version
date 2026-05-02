import { Prisma } from "@prisma/client";
import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../config/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import {
  patchProviderProfileSchema,
  providerMatchSchema,
  providerNearbySchema,
  upsertProviderProfileSchema
} from "../schemas/provider.schema.js";
import { nearbyProviders, scoreProvider } from "../services/providerService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/errors.js";

export const providersRouter = Router();

providersRouter.use(authMiddleware);

providersRouter.get(
  "/me",
  requireRole("PROVIDER"),
  asyncHandler(async (req, res) => {
    const profile = await prisma.providerProfile.findUnique({
      where: { userId: req.auth!.userId },
      include: { user: { select: { id: true, name: true, phone: true, email: true } } }
    });
    if (!profile) {
      throw new AppError("Provider profile not found", StatusCodes.NOT_FOUND, "PROFILE_NOT_FOUND");
    }
    return res.status(StatusCodes.OK).json({ profile });
  })
);

providersRouter.post(
  "/me",
  requireRole("PROVIDER"),
  validate(upsertProviderProfileSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as {
      bio?: string;
      serviceTypes: ("WALKING" | "SITTING" | "GROOMING" | "BOARDING")[];
      baseRate: number;
      latitude: number;
      longitude: number;
      radiusKm: number;
      isAvailable: boolean;
      city: "Chennai";
    };

    const profile = await prisma.providerProfile.upsert({
      where: { userId: req.auth!.userId },
      create: {
        userId: req.auth!.userId,
        serviceTypes: body.serviceTypes,
        baseRate: new Prisma.Decimal(body.baseRate),
        latitude: new Prisma.Decimal(body.latitude),
        longitude: new Prisma.Decimal(body.longitude),
        radiusKm: body.radiusKm,
        isAvailable: body.isAvailable,
        city: body.city,
        ...(body.bio !== undefined ? { bio: body.bio } : {})
      },
      update: {
        serviceTypes: body.serviceTypes,
        baseRate: new Prisma.Decimal(body.baseRate),
        latitude: new Prisma.Decimal(body.latitude),
        longitude: new Prisma.Decimal(body.longitude),
        radiusKm: body.radiusKm,
        isAvailable: body.isAvailable,
        city: body.city,
        ...(body.bio !== undefined ? { bio: body.bio } : {})
      }
    });

    return res.status(StatusCodes.OK).json({ profile });
  })
);

providersRouter.patch(
  "/me",
  requireRole("PROVIDER"),
  validate(patchProviderProfileSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.providerProfile.findUnique({ where: { userId: req.auth!.userId } });
    if (!existing) {
      throw new AppError("Provider profile not found", StatusCodes.NOT_FOUND, "PROFILE_NOT_FOUND");
    }

    const body = req.body as {
      bio?: string | null;
      serviceTypes?: ("WALKING" | "SITTING" | "GROOMING" | "BOARDING")[];
      baseRate?: number;
      latitude?: number;
      longitude?: number;
      radiusKm?: number;
      isAvailable?: boolean;
      city?: "Chennai";
    };

    const profile = await prisma.providerProfile.update({
      where: { userId: req.auth!.userId },
      data: {
        ...(body.bio !== undefined ? { bio: body.bio } : {}),
        ...(body.serviceTypes ? { serviceTypes: body.serviceTypes } : {}),
        ...(typeof body.baseRate === "number" ? { baseRate: new Prisma.Decimal(body.baseRate) } : {}),
        ...(typeof body.latitude === "number" ? { latitude: new Prisma.Decimal(body.latitude) } : {}),
        ...(typeof body.longitude === "number" ? { longitude: new Prisma.Decimal(body.longitude) } : {}),
        ...(typeof body.radiusKm === "number" ? { radiusKm: body.radiusKm } : {}),
        ...(typeof body.isAvailable === "boolean" ? { isAvailable: body.isAvailable } : {}),
        ...(body.city ? { city: body.city } : {})
      }
    });

    return res.status(StatusCodes.OK).json({ profile });
  })
);

providersRouter.get(
  "/nearby",
  validate(providerNearbySchema),
  asyncHandler(async (req, res) => {
    const { lat, lon, radiusKm, serviceType } = req.query as unknown as {
      lat: number;
      lon: number;
      radiusKm: number;
      serviceType?: "WALKING" | "SITTING" | "GROOMING" | "BOARDING";
    };

    const providers = await nearbyProviders(lat, lon, radiusKm, serviceType);
    return res.status(StatusCodes.OK).json({ providers });
  })
);

providersRouter.get(
  "/match",
  validate(providerMatchSchema),
  asyncHandler(async (req, res) => {
    const { lat, lon, serviceType } = req.query as unknown as {
      lat: number;
      lon: number;
      serviceType: "WALKING" | "SITTING" | "GROOMING" | "BOARDING";
    };

    const candidates = await nearbyProviders(lat, lon, 15, serviceType);
    const scored = candidates
      .map((candidate) => ({
        ...candidate,
        score: scoreProvider(candidate)
      }))
      .sort((a, b) => b.score - a.score);

    return res.status(StatusCodes.OK).json({
      providers: scored.slice(0, 20)
    });
  })
);
