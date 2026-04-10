import { Prisma, ServiceType } from "@prisma/client";
import { prisma } from "../config/prisma.js";

type NearbyProvider = {
  id: string;
  userId: string;
  rating: Prisma.Decimal;
  completedJobs: number;
  distance_km: number;
  baseRate: Prisma.Decimal;
};

export async function nearbyProviders(lat: number, lon: number, radiusKm: number, serviceType?: ServiceType) {
  const providers = await prisma.$queryRaw<NearbyProvider[]>(Prisma.sql`
    SELECT * FROM (
      SELECT
        p.id,
        p."userId",
        p.rating,
        p."completedJobs",
        p."baseRate",
        (
          6371 * acos(
            cos(radians(${lat})) * cos(radians(CAST(p.latitude AS double precision))) *
            cos(radians(CAST(p.longitude AS double precision)) - radians(${lon})) +
            sin(radians(${lat})) * sin(radians(CAST(p.latitude AS double precision)))
          )
        ) AS distance_km
      FROM "ProviderProfile" p
      WHERE p.city = 'Chennai'
        AND p."isAvailable" = TRUE
        ${serviceType ? Prisma.sql`AND ${serviceType} = ANY(p."serviceTypes")` : Prisma.empty}
    ) q
    WHERE q.distance_km <= ${radiusKm}
    ORDER BY q.distance_km ASC
    LIMIT 100
  `);

  return providers;
}

export function scoreProvider(candidate: NearbyProvider): number {
  const distanceScore = Math.max(0, 100 - candidate.distance_km * 10);
  const ratingScore = Number(candidate.rating) * 15;
  const completionScore = Math.min(candidate.completedJobs, 200) * 0.3;
  return Number((distanceScore + ratingScore + completionScore).toFixed(2));
}
