import { io, type Socket } from "socket.io-client";
import { publicEnv } from "@/lib/public-env";

export function createBookingSocket(accessToken: string): Socket {
  return io(publicEnv.socketUrl, {
    auth: { token: accessToken },
    transports: ["websocket", "polling"]
  });
}
