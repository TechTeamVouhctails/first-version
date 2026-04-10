import { Prisma } from "@prisma/client";
import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../config/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { createPetSchema, petIdParamSchema, updatePetSchema } from "../schemas/pet.schema.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const petsRouter = Router();

petsRouter.use(authMiddleware, requireRole("PET_PARENT"));

petsRouter.post(
  "/",
  validate(createPetSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as {
      name: string;
      species: string;
      breed?: string;
      ageYears?: number;
      weightKg?: number;
      notes?: string;
    };
    const pet = await prisma.pet.create({
      data: {
        ownerId: req.auth!.userId,
        name: body.name,
        species: body.species,
        ...(body.breed ? { breed: body.breed } : {}),
        ...(typeof body.ageYears === "number" ? { ageYears: body.ageYears } : {}),
        ...(typeof body.weightKg === "number" ? { weightKg: new Prisma.Decimal(body.weightKg) } : {}),
        ...(body.notes ? { notes: body.notes } : {})
      }
    });
    return res.status(StatusCodes.CREATED).json({ pet });
  })
);

petsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const pets = await prisma.pet.findMany({
      where: { ownerId: req.auth!.userId },
      orderBy: { createdAt: "desc" }
    });
    return res.status(StatusCodes.OK).json({ pets });
  })
);

petsRouter.get(
  "/:id",
  validate(petIdParamSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const pet = await prisma.pet.findFirstOrThrow({
      where: { id, ownerId: req.auth!.userId }
    });
    return res.status(StatusCodes.OK).json({ pet });
  })
);

petsRouter.patch(
  "/:id",
  validate(updatePetSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    const body = req.body as {
      name?: string;
      species?: string;
      breed?: string;
      ageYears?: number;
      weightKg?: number;
      notes?: string;
    };

    await prisma.pet.findFirstOrThrow({
      where: { id, ownerId: req.auth!.userId },
      select: { id: true }
    });

    const pet = await prisma.pet.update({
      where: { id },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.species ? { species: body.species } : {}),
        ...(body.breed ? { breed: body.breed } : {}),
        ...(typeof body.ageYears === "number" ? { ageYears: body.ageYears } : {}),
        ...(typeof body.weightKg === "number" ? { weightKg: new Prisma.Decimal(body.weightKg) } : {}),
        ...(body.notes ? { notes: body.notes } : {})
      }
    });
    return res.status(StatusCodes.OK).json({ pet });
  })
);

petsRouter.delete(
  "/:id",
  validate(petIdParamSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string };
    await prisma.pet.findFirstOrThrow({
      where: { id, ownerId: req.auth!.userId },
      select: { id: true }
    });
    await prisma.pet.delete({ where: { id } });
    return res.status(StatusCodes.NO_CONTENT).send();
  })
);
