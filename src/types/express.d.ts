import { Role } from "@prisma/client";
import { Logger } from "pino";

declare global {
  namespace Express {
    interface Request {
      log: Logger;
      auth?: {
        supabaseUserId: string;
        userId: string;
        role: Role | null;
      };
    }
  }
}

export {};
