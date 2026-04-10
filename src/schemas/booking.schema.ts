import { BookingState, ServiceType } from "@prisma/client";
import { z } from "zod";

const bookingIdParams = z.object({
  bookingId: z.string().cuid()
});

export const createBookingSchema = z.object({
  params: z.object({}).default({}),
  query: z.object({}).default({}),
  body: z.object({
    providerId: z.string().cuid(),
    petId: z.string().cuid(),
    serviceType: z.nativeEnum(ServiceType),
    address: z.string().min(10).max(250),
    latitude: z.number().min(12).max(14),
    longitude: z.number().min(79).max(81),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    estimatedAmount: z.number().positive().max(100000)
  })
});

export const bookingIdSchema = z.object({
  params: bookingIdParams,
  query: z.object({}).default({}),
  body: z.object({}).default({})
});

export const cancelBookingSchema = z.object({
  params: bookingIdParams,
  query: z.object({}).default({}),
  body: z.object({
    reason: z.string().min(3).max(300).optional()
  })
});

export const otpSubmitSchema = z.object({
  params: bookingIdParams,
  query: z.object({}).default({}),
  body: z.object({
    otp: z.string().length(6)
  })
});

export const manualTransitionSchema = z.object({
  params: bookingIdParams,
  query: z.object({}).default({}),
  body: z.object({
    state: z.nativeEnum(BookingState)
  })
});

export const sessionTrackSchema = z.object({
  params: bookingIdParams,
  query: z.object({}).default({}),
  body: z.object({
    latitude: z.number().min(12).max(14),
    longitude: z.number().min(79).max(81),
    speedKmph: z.number().min(0).max(120).optional(),
    accuracyM: z.number().min(0).max(200).optional(),
    batteryPct: z.number().int().min(0).max(100).optional()
  })
});
