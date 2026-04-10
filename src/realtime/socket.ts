import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { verifySupabaseJwt } from "../config/supabase.js";

export function initSocket(server: HttpServer) {
  const io = new Server(server, {
    cors: {
      origin: "*"
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

    socket.on("chat:message", (payload: { bookingId: string; body: string; senderId: string; receiverId: string }) => {
      io.to(`booking:${payload.bookingId}`).emit("chat:new-message", payload);
    });

    socket.on("session:location", (payload: { bookingId: string; latitude: number; longitude: number; speedKmph?: number }) => {
      io.to(`booking:${payload.bookingId}`).emit("session:location:update", payload);
    });
  });

  return io;
}
