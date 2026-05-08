import { BookingState, ServiceType } from "@prisma/client";
import { z } from "zod";

const bookingIdParams = z.object({
  bookingId: z.string().cuid()
});

const activeStates: BookingState[] = [
  BookingState.REQUESTED,
  BookingState.CONFIRMED,
  BookingState.OTP_READY,
  BookingState.IN_PROGRESS,
  BookingState.PENDING_END_OTP,
  BookingState.PENDING_PAYMENT,
  BookingState.PAYMENT_LOCKED,
  BookingState.PAYOUT_PENDING
];

const pastStates: BookingState[] = [
  BookingState.COMPLETED,
  BookingState.PAID_OUT,
  BookingState.CANCELLED_BY_OWNER,
  BookingState.CANCELLED_BY_PROVIDER,
  BookingState.DISPUTED
];

export const listBookingsSchema = z.object({
  params: z.object({}).default({}),
  query: z.object({
    as: z.enum(["owner", "provider", "all"]).optional(),
    scope: z.enum(["active", "past", "all"]).default("all"),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().cuid().optional()
  }),
  body: z.object({}).default({})
});

export function bookingScopeStates(scope: "active" | "past" | "all"): BookingState[] | undefined {
  if (scope === "active") return activeStates;
  if (scope === "past") return pastStates;
  return undefined;
}

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
