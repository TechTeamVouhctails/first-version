import { z } from "zod";

export const sendMessageSchema = z.object({
  params: z.object({}).default({}),
  query: z.object({}).default({}),
  body: z.object({
    bookingId: z.string().cuid(),
    receiverId: z.string().cuid(),
    body: z.string().min(1).max(2000)
  })
});

export const listMessagesSchema = z.object({
  params: z.object({}).default({}),
  query: z.object({
    bookingId: z.string().cuid(),
    limit: z.coerce.number().int().positive().max(100).default(50),
    cursor: z.string().cuid().optional()
  }),
  body: z.object({}).default({})
});
