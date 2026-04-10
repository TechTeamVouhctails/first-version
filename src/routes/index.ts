import { Router } from "express";
import { authRouter } from "./auth.routes.js";
import { bookingsRouter } from "./bookings.routes.js";
import { chatRouter } from "./chat.routes.js";
import { paymentsRouter } from "./payments.routes.js";
import { petsRouter } from "./pets.routes.js";
import { providersRouter } from "./providers.routes.js";
import { usersRouter } from "./users.routes.js";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/pets", petsRouter);
apiRouter.use("/providers", providersRouter);
apiRouter.use("/bookings", bookingsRouter);
apiRouter.use("/chat", chatRouter);
apiRouter.use("/payments", paymentsRouter);
