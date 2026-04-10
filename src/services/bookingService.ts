import { BookingState, Prisma, type PrismaClient } from "@prisma/client";
import { validateStateTransition } from "../utils/stateMachine.js";

type DbLike = PrismaClient | Prisma.TransactionClient;

export async function transitionBookingState(
  db: DbLike,
  bookingId: string,
  actorId: string,
  nextState: BookingState,
  reason?: string
) {
  const booking = await db.booking.findUniqueOrThrow({
    where: { id: bookingId },
    select: { id: true, state: true }
  });

  validateStateTransition(booking.state, nextState);

  const updated = await db.booking.update({
    where: { id: bookingId },
    data: { state: nextState }
  });

  await db.bookingStateLog.create({
    data: {
      bookingId,
      actorId,
      fromState: booking.state,
      toState: nextState,
      reason: reason ?? null
    }
  });

  return updated;
}

export function splitAmounts(estimatedAmount: number): { deposit: Prisma.Decimal; final: Prisma.Decimal } {
  const half = Number((estimatedAmount / 2).toFixed(2));
  const final = Number((estimatedAmount - half).toFixed(2));
  return {
    deposit: new Prisma.Decimal(half),
    final: new Prisma.Decimal(final)
  };
}
