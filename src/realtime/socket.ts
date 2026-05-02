import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { env } from "../config/env.js";
import { verifySupabaseJwt } from "../config/supabase.js";

let ioRef: Server | null = null;

export function getSocketIo(): Server | null {
  return ioRef;
}

export function initSocket(server: HttpServer) {
  const io = new Server(server, {
    cors: {
      origin: env.CORS_ORIGINS,
      methods: ["GET", "POST"]
    }
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token || typeof token !== "string") {
        throw new Error("Missing token");
      }
      const payload = await verifySupabaseJwt(token);
      socket.data.userId = payload.sub;
      return next();
    } catch (err) {
      return next(err as Error);
    }
  });

  io.on("connection", (socket) => {
    socket.on("booking:join", (bookingId: string) => {
      socket.join(`booking:${bookingId}`);
    });

    socket.on(
      "session:location",
      (payload: { bookingId: string; latitude: number; longitude: number; speedKmph?: number }) => {
        io.to(`booking:${payload.bookingId}`).emit("session:location:update", payload);
      }
    );
  });

  ioRef = io;
  return io;
}
