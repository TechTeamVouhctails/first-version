import { ServiceType } from "@prisma/client";
import { z } from "zod";

export const providerNearbySchema = z.object({
  params: z.object({}).default({}),
  query: z.object({
    lat: z.coerce.number().min(12).max(14),
    lon: z.coerce.number().min(79).max(81),
    radiusKm: z.coerce.number().positive().max(50).default(10),
    serviceType: z.nativeEnum(ServiceType).optional()
  }),
  body: z.object({}).default({})
});

export const providerMatchSchema = z.object({
  params: z.object({}).default({}),
  query: z.object({
    lat: z.coerce.number().min(12).max(14),
    lon: z.coerce.number().min(79).max(81),
    serviceType: z.nativeEnum(ServiceType),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date()
  }),
  body: z.object({}).default({})
});
