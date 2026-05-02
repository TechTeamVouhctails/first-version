import { ServiceType } from "@prisma/client";
import { z } from "zod";

const cityEnum = z.enum(["Chennai"]);

export const upsertProviderProfileSchema = z.object({
  params: z.object({}).default({}),
  query: z.object({}).default({}),
  body: z.object({
    bio: z.string().max(2000).optional(),
    serviceTypes: z.array(z.nativeEnum(ServiceType)).min(1),
    baseRate: z.number().positive().max(1_000_000),
    latitude: z.number().min(12).max(14),
    longitude: z.number().min(79).max(81),
    radiusKm: z.coerce.number().int().min(1).max(100).default(10),
    isAvailable: z.boolean().default(true),
    city: cityEnum.default("Chennai")
  })
});

export const patchProviderProfileSchema = z.object({
  params: z.object({}).default({}),
  query: z.object({}).default({}),
  body: z
    .object({
      bio: z.string().max(2000).nullable().optional(),
      serviceTypes: z.array(z.nativeEnum(ServiceType)).min(1).optional(),
      baseRate: z.number().positive().max(1_000_000).optional(),
      latitude: z.number().min(12).max(14).optional(),
      longitude: z.number().min(79).max(81).optional(),
      radiusKm: z.coerce.number().int().min(1).max(100).optional(),
      isAvailable: z.boolean().optional(),
      city: cityEnum.optional()
    })
    .refine((b) => Object.keys(b).length > 0, { message: "At least one field required" })
});

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
