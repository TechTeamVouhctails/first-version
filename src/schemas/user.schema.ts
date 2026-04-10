import { z } from "zod";

export const updateProfileSchema = z.object({
  params: z.object({}).default({}),
  query: z.object({}).default({}),
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    email: z.string().email().optional(),
    city: z.literal("Chennai").optional()
  })
});
