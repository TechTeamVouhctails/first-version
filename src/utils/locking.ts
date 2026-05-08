import { createHash } from "crypto";
import { prisma } from "../config/prisma.js";

function lockKeyToBigInt(lockName: string): bigint {
  const digest = createHash("sha256").update(lockName, "utf8").digest("hex");
  const hex = digest.slice(0, 15);
  return BigInt(`0x${hex}`);
}

async function releaseLock(lockId: bigint) {
  await prisma.$executeRaw`SELECT pg_advisory_unlock(${lockId})`;
}

export async function withPgAdvisoryLock<T>(lockName: string, work: () => Promise<T>): Promise<{ acquired: boolean; result?: T }> {
  const lockId = lockKeyToBigInt(lockName);
  const rows = await prisma.$queryRaw<Array<{ acquired: boolean }>>`SELECT pg_try_advisory_lock(${lockId}) as acquired`;
  const acquired = rows[0]?.acquired ?? false;
  if (!acquired) return { acquired: false };

  try {
    const result = await work();
    return { acquired: true, result };
  } finally {
    await releaseLock(lockId);
  }
}
