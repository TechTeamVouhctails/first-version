import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { authMiddleware } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { providerMatchSchema, providerNearbySchema } from "../schemas/provider.schema.js";
import { nearbyProviders, scoreProvider } from "../services/providerService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const providersRouter = Router();

providersRouter.use(authMiddleware);

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
