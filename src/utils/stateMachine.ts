import { BookingState } from "@prisma/client";
import { AppError } from "./errors.js";

const transitionMap: Record<BookingState, BookingState[]> = {
  REQUESTED: ["CONFIRMED", "CANCELLED_BY_OWNER", "CANCELLED_BY_PROVIDER"],
  CONFIRMED: ["OTP_READY", "CANCELLED_BY_OWNER", "CANCELLED_BY_PROVIDER", "DISPUTED"],
  OTP_READY: ["IN_PROGRESS", "CANCELLED_BY_OWNER", "CANCELLED_BY_PROVIDER", "DISPUTED"],
  IN_PROGRESS: ["PENDING_END_OTP", "DISPUTED"],
  PENDING_END_OTP: ["PENDING_PAYMENT", "DISPUTED"],
  PENDING_PAYMENT: ["COMPLETED", "DISPUTED"],
  COMPLETED: ["PAYOUT_PENDING", "DISPUTED"],
  PAYOUT_PENDING: ["PAID_OUT", "DISPUTED"],
  PAID_OUT: [],
  CANCELLED_BY_OWNER: [],
  CANCELLED_BY_PROVIDER: [],
  DISPUTED: []
};

export function validateStateTransition(current: BookingState, next: BookingState): void {
  const allowed = transitionMap[current];
  if (!allowed.includes(next)) {
    throw new AppError(`Invalid booking state transition: ${current} -> ${next}`, 409, "INVALID_STATE_TRANSITION");
  }
}

export function canTransition(current: BookingState, next: BookingState): boolean {
  return transitionMap[current].includes(next);
}
