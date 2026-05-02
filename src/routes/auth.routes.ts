import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../config/prisma.js";
import { supabaseClient } from "../config/supabase.js";
import { env } from "../config/env.js";
import { authMiddleware } from "../middleware/auth.js";
import { otpRateLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import { sendOtpSchema, setRoleSchema, verifyOtpSchema } from "../schemas/auth.schema.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/errors.js";

export const authRouter = Router();

/** Supabase phone OTP requires an SMS hook/provider in project settings — errors are opaque otherwise. */
function otpSendExplain(supabaseMessage: string) {
  const m = supabaseMessage.toLowerCase();
  const phoneMisconfig =
    m.includes("unsupported phone") ||
    m.includes("phone provider") ||
    m.includes("sms provider") ||
    m.includes("phone signups are disabled") ||
    (m.includes("provider") && m.includes("sms"));
  if (!phoneMisconfig) return { summary: supabaseMessage };

  return {
    summary:
      "Phone (SMS) sign-in is not fully configured on your Supabase project, so OTP cannot be sent.",
    supabase_error: supabaseMessage,
    fix: [
      "Supabase Dashboard → Authentication → Providers → Phone → enable Phone provider.",
      "Under the same Phone section: configure SMS (built-in Trial for dev, Twilio/MessageBird/etc. for production) or a Send SMS hook.",
      `Confirm JWT signing and Auth URL match this backend (project: ${env.SUPABASE_URL}).`
    ]
  };
}

authRouter.post(
  "/send-otp",
  otpRateLimiter,
  validate(sendOtpSchema),
  asyncHandler(async (req, res) => {
    const { phone } = req.body as { phone: string };
    const { error } = await supabaseClient.auth.signInWithOtp({
      phone,
      options: { shouldCreateUser: true }
    });
    if (error) {
      const explained = otpSendExplain(error.message);
      throw new AppError(explained.summary, StatusCodes.BAD_REQUEST, "OTP_SEND_FAILED", explained);
    }
    return res.status(StatusCodes.OK).json({ success: true });
  })
);

authRouter.post(
  "/verify-otp",
  otpRateLimiter,
  validate(verifyOtpSchema),
  asyncHandler(async (req, res) => {
    const { phone, token } = req.body as { phone: string; token: string };

    const { data, error } = await supabaseClient.auth.verifyOtp({
      phone,
      token,
      type: "sms"
    });

    if (error || !data.user || !data.session) {
      throw new AppError(error?.message ?? "OTP verification failed", StatusCodes.UNAUTHORIZED, "OTP_VERIFY_FAILED");
    }

    const updateData: { phone?: string; email?: string } = {};
    if (data.user.phone) updateData.phone = data.user.phone;
    if (data.user.email) updateData.email = data.user.email;

    const createData: { supabaseUserId: string; phone?: string; email?: string } = {
      supabaseUserId: data.user.id
    };
    if (data.user.phone) createData.phone = data.user.phone;
    if (data.user.email) createData.email = data.user.email;

    const user = await prisma.user.upsert({
      where: { supabaseUserId: data.user.id },
      update: updateData,
      create: createData
    });

    return res.status(StatusCodes.OK).json({
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      user
    });
  })
);

authRouter.post(
  "/set-role",
  authMiddleware,
  validate(setRoleSchema),
  asyncHandler(async (req, res) => {
    const { role } = req.body as { role: "PET_PARENT" | "PROVIDER" };
    const userId = req.auth!.userId;

    const user = await prisma.user.update({
      where: { id: userId },
      data: { role }
    });

    return res.status(StatusCodes.OK).json({ user });
  })
);
