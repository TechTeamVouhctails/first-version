import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";

describe("API validation", () => {
  it("rejects invalid phone format for send OTP", async () => {
    const res = await request(app).post("/api/auth/send-otp").send({ phone: "9999999999" });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("rejects invalid create booking payload before auth", async () => {
    const res = await request(app).post("/api/bookings").send({});
    expect(res.status).toBe(401);
  });
});
