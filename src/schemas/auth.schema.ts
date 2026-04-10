import { Role } from "@prisma/client";
import { z } from "zod";

const phoneSchema = z.string().regex(/^\+91[6-9]\d{9}$/, "Phone must be E.164 Indian number");

export const sendOtpSchema = z.object({
  params: z.object({}).default({}),
  query: z.object({}).default({}),
  body: z.object({
    phone: phoneSchema
  })
});

export const verifyOtpSchema = z.object({
  params: z.object({}).default({}),
  query: z.object({}).default({}),
  body: z.object({
    phone: phoneSchema,
    token: z.string().length(6)
  })
});

export const setRoleSchema = z.object({
  params: z.object({}).default({}),
  query: z.object({}).default({}),
  body: z.object({
    role: z.nativeEnum(Role)
  })
});
