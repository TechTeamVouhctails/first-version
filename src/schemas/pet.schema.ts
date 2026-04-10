import { z } from "zod";

const idParams = z.object({
  id: z.string().cuid()
});

export const createPetSchema = z.object({
  params: z.object({}).default({}),
  query: z.object({}).default({}),
  body: z.object({
    name: z.string().min(1).max(100),
    species: z.string().min(1).max(50),
    breed: z.string().max(100).optional(),
    ageYears: z.number().int().min(0).max(40).optional(),
    weightKg: z.number().positive().max(200).optional(),
    notes: z.string().max(1000).optional()
  })
});

export const updatePetSchema = z.object({
  params: idParams,
  query: z.object({}).default({}),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    species: z.string().min(1).max(50).optional(),
    breed: z.string().max(100).optional(),
    ageYears: z.number().int().min(0).max(40).optional(),
    weightKg: z.number().positive().max(200).optional(),
    notes: z.string().max(1000).optional()
  })
});

export const petIdParamSchema = z.object({
  params: idParams,
  query: z.object({}).default({}),
  body: z.object({}).default({})
});
